"""EIP-712 claim verification.

Without this the oracle mints to whatever address the caller types, so anyone
could be paid for somebody else's reasoning. The claim binds the trace hash, the
beneficiary, the answer being claimed and a nonce, and only the beneficiary's key
can produce it.
"""

from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3

DOMAIN_NAME = "CalchAI Proof of Reasoning"
DOMAIN_VERSION = "1"

CLAIM_TYPES = {
    "ReasoningClaim": [
        {"name": "user", "type": "address"},
        {"name": "reasoningHash", "type": "bytes32"},
        {"name": "problemId", "type": "string"},
        {"name": "answer", "type": "string"},
        {"name": "nonce", "type": "uint256"},
    ]
}


def reasoning_hash(reasoning: str) -> str:
    return Web3.to_hex(Web3.keccak(text=reasoning))


def claim_payload(
    user: str,
    reasoning: str,
    problem_id: str | None,
    answer: str | None,
    nonce: int,
    chain_id: int,
    token: str,
) -> dict:
    """The exact typed-data object the dApp must sign with eth_signTypedData_v4."""
    return {
        "domain": {
            "name": DOMAIN_NAME,
            "version": DOMAIN_VERSION,
            "chainId": chain_id,
            "verifyingContract": Web3.to_checksum_address(token),
        },
        "types": CLAIM_TYPES,
        "primaryType": "ReasoningClaim",
        "message": {
            "user": Web3.to_checksum_address(user),
            "reasoningHash": reasoning_hash(reasoning),
            "problemId": problem_id or "",
            "answer": answer or "",
            "nonce": nonce,
        },
    }


def recover_claim_signer(
    user: str,
    reasoning: str,
    problem_id: str | None,
    answer: str | None,
    nonce: int,
    signature: str,
    chain_id: int,
    token: str,
) -> str:
    payload = claim_payload(user, reasoning, problem_id, answer, nonce, chain_id, token)
    encoded = encode_typed_data(
        domain_data=payload["domain"],
        message_types=payload["types"],
        message_data=payload["message"],
    )
    return Account.recover_message(encoded, signature=signature)
