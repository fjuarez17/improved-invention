"""Publishing the reasoning trace so the CID in the event points at something.

A CID nobody stores proves nothing. When a pinning backend is configured the trace
is uploaded and the returned CID goes on-chain; otherwise the deterministic
stand-in is used and the response says so, so the demo never claims IPFS.
"""

import hashlib
import os

import httpx

PINATA_JWT = os.environ.get("PINATA_JWT", "")
PINATA_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
IPFS_API_URL = os.environ.get("IPFS_API_URL", "")  # e.g. http://127.0.0.1:5001
PIN_TIMEOUT = float(os.environ.get("ORACLE_PIN_TIMEOUT", "20"))
GATEWAY = os.environ.get("IPFS_GATEWAY", "https://ipfs.io/ipfs")


def deterministic_cid(text: str) -> str:
    """Reproducible stand-in with CID shape; identical to the BNB agent's output."""
    return f"bafy{hashlib.sha256(text.encode()).hexdigest()[:46]}"


def pinning_enabled() -> bool:
    return bool(PINATA_JWT or IPFS_API_URL)


def pin_trace(user: str, reasoning: str, score: int, problem_id: str | None) -> tuple[str, bool]:
    """Returns (cid, pinned). Falls back to the deterministic CID on any failure."""
    document = {
        "protocol": "CalchAI Proof of Reasoning",
        "user": user,
        "problemId": problem_id,
        "score": score,
        "reasoning": reasoning,
    }
    try:
        if PINATA_JWT:
            response = httpx.post(
                PINATA_URL,
                json={"pinataContent": document},
                headers={"Authorization": f"Bearer {PINATA_JWT}"},
                timeout=PIN_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()["IpfsHash"], True
        if IPFS_API_URL:
            response = httpx.post(
                f"{IPFS_API_URL.rstrip('/')}/api/v0/add",
                files={"file": ("trace.json", reasoning.encode())},
                timeout=PIN_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()["Hash"], True
    except (httpx.HTTPError, KeyError, ValueError):
        pass  # a pinning outage must not block the reward loop
    return deterministic_cid(reasoning), False


def gateway_url(cid: str, pinned: bool) -> str | None:
    return f"{GATEWAY.rstrip('/')}/{cid}" if pinned else None
