"""CalchAI oracle: the only wallet allowed to emit $COGN.

The emission path is: signed claim -> verifiable answer -> quality score -> pinned
CID -> on-chain reward. The signature proves who reasoned, the answer check makes
farming unprofitable, and the score only sizes the reward.
"""

import json
import os
import re
import threading
import time
from pathlib import Path

from dotenv import load_dotenv
from eth_utils.exceptions import ValidationError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from web3 import Web3

from .auth import claim_payload, recover_claim_signer
from .pinning import gateway_url, pin_trace, pinning_enabled
from .problems import PROBLEMS, check_answer

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "oracle.env")  # non-hidden copy, for hosts that skip dotfiles
load_dotenv(ROOT.parent / ".env")

TOKEN_ABI = json.loads(
    """[
 {"inputs":[{"name":"user","type":"address"},{"name":"amount","type":"uint256"},{"name":"reasoningCid","type":"string"}],"name":"mintCognitiveReward","outputs":[],"stateMutability":"nonpayable","type":"function"},
 {"inputs":[],"name":"oracleAddress","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"},
 {"inputs":[],"name":"maxRewardPerMint","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
 {"inputs":[{"type":"bytes32"}],"name":"rewardedReasoning","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"}
]"""
)

TOKEN_ADDRESS = os.environ.get("TOKEN_ADDRESS", "0x3721E5c3162FEA106ddC42baBAcEF09664EF625F")
VESTING_ADDRESS = os.environ.get("VESTING_ADDRESS", "0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A")
RPC_URL = os.environ.get("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz/")
EXPLORER = "https://testnet.monadexplorer.com"
CHAIN_ID = 10143

# Public-demo guardrails: one reward per wallet per cooldown, and a daily emission budget.
COOLDOWN_SECONDS = int(os.environ.get("ORACLE_COOLDOWN_SECONDS", "120"))
DAILY_BUDGET_COGN = float(os.environ.get("ORACLE_DAILY_BUDGET", "5000"))
MAX_REASONING_CHARS = int(os.environ.get("ORACLE_MAX_REASONING_CHARS", "8000"))
# Signature verification is the difference between rewarding an author and rewarding
# whoever pastes their text. Only disable it for local tests.
REQUIRE_SIGNATURE = os.environ.get("ORACLE_REQUIRE_SIGNATURE", "true").lower() != "false"
# A trace with no checkable answer can be mass-produced, so it earns a token amount.
FREEFORM_MAX_COGN = float(os.environ.get("ORACLE_FREEFORM_MAX_COGN", "1"))
VERIFIED_MAX_COGN = float(os.environ.get("ORACLE_VERIFIED_MAX_COGN", "10"))
STATE_FILE = Path(os.environ.get("ORACLE_STATE_FILE", ROOT / "oracle-state.json"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ORACLE_ALLOWED_ORIGINS",
        "https://dist-zyczpjct.devinapps.com,http://localhost:5173",
    ).split(",")
    if o.strip()
]

w3 = Web3(Web3.HTTPProvider(RPC_URL))
token = w3.eth.contract(address=Web3.to_checksum_address(TOKEN_ADDRESS), abi=TOKEN_ABI)


def oracle_account():
    """Signing account, resolved on first use so the module imports without the key."""
    key = os.environ.get("ORACLE_PRIVATE_KEY")
    if not key:
        raise RuntimeError("ORACLE_PRIVATE_KEY is not configured")
    return w3.eth.account.from_key(key)


# Emission accounting survives restarts and is serialised: otherwise a restart (or two
# concurrent requests) would hand out a second full daily allowance.
mint_lock = threading.Lock()
last_reward_at: dict[str, float] = {}
spent_today = {"day": time.gmtime().tm_yday, "amount": 0.0}
# Consumed claim nonces, so a captured signature cannot be replayed.
used_nonces: dict[str, list[int]] = {}
NONCE_HISTORY = int(os.environ.get("ORACLE_NONCE_HISTORY", "200"))


def load_state() -> None:
    try:
        state = json.loads(STATE_FILE.read_text())
    except (OSError, ValueError):
        return
    if state.get("day") == time.gmtime().tm_yday:
        spent_today.update(day=state["day"], amount=float(state.get("amount", 0.0)))
    last_reward_at.update(
        {k: float(v) for k, v in (state.get("lastRewardAt") or {}).items()}
    )
    used_nonces.update(
        {k: [int(n) for n in v] for k, v in (state.get("usedNonces") or {}).items()}
    )


def save_state() -> None:
    try:
        STATE_FILE.write_text(
            json.dumps(
                {
                    **spent_today,
                    "lastRewardAt": last_reward_at,
                    "usedNonces": used_nonces,
                }
            )
        )
    except OSError:
        pass  # accounting stays in memory if the filesystem is read-only


load_state()


def originality(text: str) -> float:
    """Collapses the score of padded or copy-pasted text.

    Depth and structure alone reward volume, which a generator produces for free.
    Repeated words and repeated lines are what that generated padding looks like.
    """
    words = [re.sub(r"[^\w]", "", w).lower() for w in text.split() if w]
    words = [w for w in words if w]
    if not words:
        return 0.0
    unique_words = len(set(words)) / len(words)
    lines = [line.strip().lower() for line in text.split("\n") if line.strip()]
    unique_lines = len(set(lines)) / len(lines) if lines else 1.0
    return min(unique_words / 0.5, 1.0) * min(unique_lines / 0.8, 1.0)


def score_reasoning(text: str) -> int:
    """Proof of Reasoning quality score: depth, structure and conclusion, minus padding."""
    words = len([w for w in text.split() if w])
    steps = len(re.findall(r"\n\s*(\d+\.|-|\*)", text))
    has_conclusion = bool(re.search(r"(por lo tanto|therefore|conclusi[oó]n|luego)", text, re.I))
    raw = min(words / 120, 1) * 0.5 + min(steps / 5, 1) * 0.3 + (0.2 if has_conclusion else 0)
    return round(raw * originality(text) * 100)


def budget_left(amount: float) -> bool:
    day = time.gmtime().tm_yday
    if spent_today["day"] != day:
        spent_today.update(day=day, amount=0.0)
    return spent_today["amount"] + amount <= DAILY_BUDGET_COGN


app = FastAPI(title="CalchAI Oracle")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)


class Evaluation(BaseModel):
    user: str
    reasoning: str
    problemId: str | None = None
    answer: str | None = None
    nonce: int | None = None
    signature: str | None = None


@app.get("/health")
def health():
    account = oracle_account()
    return {
        "oracle": account.address,
        "onChainOracle": token.functions.oracleAddress().call(),
        "token": TOKEN_ADDRESS,
        "vesting": VESTING_ADDRESS,
        "chainId": CHAIN_ID,
        "gasBalanceMon": float(w3.from_wei(w3.eth.get_balance(account.address), "ether")),
        "dailyBudgetCogn": DAILY_BUDGET_COGN,
        "spentTodayCogn": spent_today["amount"],
        "requireSignature": REQUIRE_SIGNATURE,
        "ipfsPinning": pinning_enabled(),
    }


@app.get("/problems")
def problems():
    """Problems with a checkable answer: the only ones that earn a full reward."""
    return {
        "problems": [{"id": p.id, "statement": p.statement} for p in PROBLEMS.values()],
        "freeformMaxCogn": FREEFORM_MAX_COGN,
        "verifiedMaxCogn": VERIFIED_MAX_COGN,
    }


@app.post("/claim-payload")
def build_claim_payload(body: Evaluation):
    """The typed data the wallet must sign, so the dApp never rebuilds it by hand."""
    if not Web3.is_address(body.user):
        return JSONResponse({"error": "invalid user address"}, status_code=400)
    nonce = body.nonce if body.nonce is not None else int(time.time() * 1000)
    return {
        "nonce": nonce,
        "typedData": claim_payload(
            body.user,
            body.reasoning,
            body.problemId,
            body.answer,
            nonce,
            CHAIN_ID,
            TOKEN_ADDRESS,
        ),
    }


@app.post("/evaluate")
def evaluate(body: Evaluation):
    if not Web3.is_address(body.user):
        return JSONResponse({"error": "invalid user address"}, status_code=400)
    if len(body.reasoning.strip()) < 20:
        return JSONResponse({"error": "reasoning too short to be worth rewarding"}, status_code=400)
    if len(body.reasoning) > MAX_REASONING_CHARS:
        return JSONResponse(
            {"error": f"reasoning longer than {MAX_REASONING_CHARS} characters"},
            status_code=413,
        )

    user = Web3.to_checksum_address(body.user)

    # 1. Who is claiming: only the beneficiary's key can sign the claim.
    if REQUIRE_SIGNATURE:
        if body.signature is None or body.nonce is None:
            return JSONResponse(
                {"error": "signed claim required: call /claim-payload and sign it"},
                status_code=401,
            )
        try:
            signer = recover_claim_signer(
                user,
                body.reasoning,
                body.problemId,
                body.answer,
                body.nonce,
                body.signature,
                CHAIN_ID,
                TOKEN_ADDRESS,
            )
        except (ValueError, TypeError, ValidationError):
            return JSONResponse({"error": "malformed signature"}, status_code=401)
        if signer != user:
            return JSONResponse(
                {"error": "signature does not belong to the claimed address"},
                status_code=401,
            )

    # 2. Is the result right: prose quality can be generated, a correct answer cannot.
    verified = False
    if body.problemId is not None:
        problem = PROBLEMS.get(body.problemId)
        if problem is None:
            return JSONResponse({"error": "unknown problemId"}, status_code=400)
        if not body.answer or not check_answer(problem, body.answer):
            return {
                "rewarded": False,
                "score": 0,
                "reason": "the submitted answer is incorrect, so the trace earns nothing",
            }
        verified = True

    # 3. How good is the reasoning: this only sizes the reward.
    score = score_reasoning(body.reasoning)
    if score < 40:
        return {"rewarded": False, "score": score, "reason": "score below the 40 quality threshold"}

    cap = VERIFIED_MAX_COGN if verified else FREEFORM_MAX_COGN
    amount = round(score / 100 * cap, 4)

    # Checks, accounting and signing happen under one lock so two simultaneous requests
    # cannot share a nonce or spend the same budget twice.
    with mint_lock:
        if body.nonce is not None and body.nonce in used_nonces.get(user, []):
            return JSONResponse({"error": "claim nonce already used"}, status_code=409)

        # The CID depends only on the trace, so an already-paid trace must be rejected as a
        # duplicate before any rate limit: a 429 would suggest it becomes claimable later.
        cid, pinned = pin_trace(body.reasoning)
        if token.functions.rewardedReasoning(Web3.keccak(text=cid)).call():
            return JSONResponse(
                {
                    "rewarded": False,
                    "score": score,
                    "cid": cid,
                    "reason": "this reasoning trace was already rewarded on-chain (duplicate CID)",
                },
                status_code=409,
            )

        waited = time.time() - last_reward_at.get(user, 0)
        if waited < COOLDOWN_SECONDS:
            return JSONResponse(
                {
                    "rewarded": False,
                    "score": score,
                    "reason": f"cooldown: wait {int(COOLDOWN_SECONDS - waited)}s before the next reward",
                },
                status_code=429,
            )
        if not budget_left(amount):
            return JSONResponse(
                {"rewarded": False, "score": score, "reason": "daily emission budget exhausted"},
                status_code=429,
            )

        account = oracle_account()
        tx = token.functions.mintCognitiveReward(
            user, w3.to_wei(amount, "ether"), cid
        ).build_transaction(
            {
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "chainId": CHAIN_ID,
            }
        )
        signed = account.sign_transaction(tx)
        # Charged as soon as it is broadcast: a late confirmation must not escape the budget.
        last_reward_at[user] = time.time()
        spent_today["amount"] += amount
        if body.nonce is not None:
            # Bounded history: older nonces cannot be replayed anyway, the cooldown
            # and the on-chain duplicate-CID check already cover a repeated trace.
            used_nonces[user] = (used_nonces.get(user, []) + [body.nonce])[-NONCE_HISTORY:]
        save_state()
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        return JSONResponse({"error": "mint reverted", "score": score, "cid": cid}, status_code=500)

    tx_hex = Web3.to_hex(receipt.transactionHash)
    return {
        "rewarded": True,
        "score": score,
        "cid": cid,
        "cidPinned": pinned,
        "cidUrl": gateway_url(cid, pinned),
        "answerVerified": verified,
        "amount": amount,
        "txHash": tx_hex,
        "explorer": f"{EXPLORER}/tx/{tx_hex}",
    }
