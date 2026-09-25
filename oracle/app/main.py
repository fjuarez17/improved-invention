"""CalchAI oracle: the only wallet allowed to emit $COGN.

In production this is where the Vertex AI evaluator decides whether a reasoning trace
deserves a reward and pins it to IPFS. Scoring and pinning are stubbed so the demo can
show the full loop: reasoning -> score -> CID -> on-chain reward.
"""

import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from web3 import Web3

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


def save_state() -> None:
    try:
        STATE_FILE.write_text(
            json.dumps({**spent_today, "lastRewardAt": last_reward_at})
        )
    except OSError:
        pass  # accounting stays in memory if the filesystem is read-only


load_state()


def score_reasoning(text: str) -> int:
    """Stub of the Proof of Reasoning evaluator: rewards depth, structure and verifiability."""
    words = len([w for w in text.split() if w])
    steps = len(re.findall(r"\n\s*(\d+\.|-|\*)", text))
    has_conclusion = bool(re.search(r"(por lo tanto|therefore|conclusi[oó]n|luego)", text, re.I))
    raw = min(words / 120, 1) * 0.5 + min(steps / 5, 1) * 0.3 + (0.2 if has_conclusion else 0)
    return round(raw * 100)


def fake_cid(text: str) -> str:
    """Deterministic stand-in for pinning the trace to IPFS."""
    return f"bafy{hashlib.sha256(text.encode()).hexdigest()[:46]}"


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
    score = score_reasoning(body.reasoning)
    if score < 40:
        return {"rewarded": False, "score": score, "reason": "score below the 40 quality threshold"}

    cid = fake_cid(body.reasoning)
    amount = score / 10  # up to 10 COGN per trace

    # Checks, accounting and signing happen under one lock so two simultaneous requests
    # cannot share a nonce or spend the same budget twice.
    with mint_lock:
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
        "amount": amount,
        "txHash": tx_hex,
        "explorer": f"{EXPLORER}/tx/{tx_hex}",
    }
