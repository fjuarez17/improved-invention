"""Tests for the emission path: who claims, whether the answer is right, and what gets pinned.

The chain is stubbed: these cover the oracle's decisions, not Monad's.
"""

import os
import sys
from pathlib import Path

import pytest
from eth_account import Account
from eth_account.messages import encode_typed_data
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ORACLE_STATE_FILE", "/tmp/calchai-test-state.json")
os.environ.setdefault("ORACLE_COOLDOWN_SECONDS", "0")

from app import main  # noqa: E402
from app.auth import claim_payload, recover_claim_signer  # noqa: E402
from app.pinning import deterministic_cid  # noqa: E402
from app.problems import PROBLEMS, addresses_problem, check_answer  # noqa: E402

USER = Account.from_key("0x" + "11" * 32)
OTHER = Account.from_key("0x" + "22" * 32)

GOOD_TRACE = """Analizo el problema de los trenes.
1. Las ciudades están separadas por 300 km y los trenes avanzan uno hacia el otro.
2. Sus velocidades se suman: 60 km/h + 90 km/h = 150 km/h de acercamiento.
3. El tiempo hasta cruzarse es 300 / 150 = 2 horas.
4. En esas 2 horas el tren lento, a 60 km/h, recorre 60 por 2 kilómetros.
5. Compruebo: el rápido recorre 180 km y 120 + 180 = 300 km, cuadra.
Por lo tanto el tren más lento recorre 120 kilómetros hasta el cruce."""

UNRELATED_TRACE = """Calculo la derivada de f(x) = x^2 * ln(x).
1. Aplico la regla del producto con u = x^2 y v = ln(x).
2. La derivada de u es 2x y la derivada de v es 1/x.
3. Sumo u'v + uv' y obtengo 2x ln(x) + x.
4. Compruebo evaluando en x = 1, donde la pendiente vale 1.
5. Reviso los signos y el dominio x > 0 de la función.
Por lo tanto f'(x) = 2x ln(x) + x, y la respuesta pedida es 120."""


def sign(account, reasoning, nonce, problem_id=None, answer=None):
    payload = claim_payload(
        account.address, reasoning, problem_id, answer, nonce, main.CHAIN_ID, main.TOKEN_ADDRESS
    )
    encoded = encode_typed_data(
        domain_data=payload["domain"],
        message_types=payload["types"],
        message_data=payload["message"],
    )
    return account.sign_message(encoded).signature.hex()


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "STATE_FILE", tmp_path / "state.json")
    monkeypatch.setattr(main, "COOLDOWN_SECONDS", 0)
    main.used_nonces.clear()
    main.last_reward_at.clear()
    main.spent_today["amount"] = 0.0
    return TestClient(main.app)


class FakeCall:
    def __init__(self, value):
        self.value = value

    def call(self):
        return self.value

    def build_transaction(self, _tx):
        return {"gas": 21000}


class FakeFunctions:
    def __init__(self, rewarded):
        self.rewarded = rewarded
        self.minted = []

    def rewardedReasoning(self, key):
        return FakeCall(key in self.rewarded)

    def mintCognitiveReward(self, user, amount, cid):
        self.minted.append((user, amount, cid))
        return FakeCall(None)


@pytest.fixture
def chain(monkeypatch):
    """Stub the token contract and the signing/broadcast path."""
    functions = FakeFunctions(set())
    monkeypatch.setattr(main, "token", type("T", (), {"functions": functions})())

    class FakeEth:
        def get_transaction_count(self, _addr):
            return 0

        def send_raw_transaction(self, _raw):
            return b"\x01" * 32

        def wait_for_transaction_receipt(self, tx_hash, timeout=0):
            return type("R", (), {"status": 1, "transactionHash": tx_hash})()

    monkeypatch.setattr(main.w3, "eth", FakeEth())
    monkeypatch.setattr(
        main,
        "oracle_account",
        lambda: type(
            "A",
            (),
            {
                "address": OTHER.address,
                "sign_transaction": lambda self, tx: type("S", (), {"raw_transaction": b""})(),
            },
        )(),
    )
    return functions


def test_health_reports_missing_signer_without_failing(monkeypatch, client):
    monkeypatch.delenv("ORACLE_PRIVATE_KEY", raising=False)

    class Functions:
        def oracleAddress(self):
            return FakeCall(OTHER.address)

    monkeypatch.setattr(main, "token", type("T", (), {"functions": Functions()})())

    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["oracleConfigured"] is False
    assert body["oracle"] is None
    assert body["onChainOracle"] == OTHER.address
    assert body["rpcConnected"] is True


def test_signature_roundtrip_recovers_the_signer():
    nonce = 1
    signature = sign(USER, GOOD_TRACE, nonce)
    recovered = recover_claim_signer(
        USER.address, GOOD_TRACE, None, None, nonce, signature, main.CHAIN_ID, main.TOKEN_ADDRESS
    )
    assert recovered == USER.address


def test_signature_of_a_different_trace_does_not_recover_the_signer():
    signature = sign(USER, GOOD_TRACE, 1)
    recovered = recover_claim_signer(
        USER.address,
        GOOD_TRACE + " extra",
        None,
        None,
        1,
        signature,
        main.CHAIN_ID,
        main.TOKEN_ADDRESS,
    )
    assert recovered != USER.address


def test_claim_payload_binds_chain_and_token():
    payload = claim_payload(
        USER.address, GOOD_TRACE, None, None, 7, main.CHAIN_ID, main.TOKEN_ADDRESS
    )
    assert payload["domain"]["chainId"] == main.CHAIN_ID
    assert payload["domain"]["verifyingContract"].lower() == main.TOKEN_ADDRESS.lower()
    assert payload["message"]["nonce"] == 7


def test_unsigned_claim_is_rejected(client):
    response = client.post("/evaluate", json={"user": USER.address, "reasoning": GOOD_TRACE})
    assert response.status_code == 401


def test_malformed_signature_is_rejected(client):
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "nonce": 1,
            "signature": "0xdeadbeef",
        },
    )
    assert response.status_code == 401


def test_claiming_someone_elses_trace_is_rejected(client):
    """The core fix: signing with your own key does not let you cash another wallet's text."""
    response = client.post(
        "/evaluate",
        json={
            "user": OTHER.address,
            "reasoning": GOOD_TRACE,
            "nonce": 1,
            "signature": sign(USER, GOOD_TRACE, 1),
        },
    )
    assert response.status_code == 401


def test_unknown_problem_is_rejected(client):
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "problemId": "nope",
            "answer": "120",
            "nonce": 1,
            "signature": sign(USER, GOOD_TRACE, 1, "nope", "120"),
        },
    )
    assert response.status_code == 400


def test_wrong_answer_earns_nothing(client):
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "problemId": "trains",
            "answer": "999",
            "nonce": 1,
            "signature": sign(USER, GOOD_TRACE, 1, "trains", "999"),
        },
    )
    assert response.json()["rewarded"] is False
    assert response.json()["score"] == 0


def test_verified_answer_pays_more_than_free_form(client, chain):
    free = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "nonce": 1,
            "signature": sign(USER, GOOD_TRACE, 1),
        },
    ).json()
    main.used_nonces.clear()
    verified = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "problemId": "trains",
            "answer": "120 km/h",
            "nonce": 2,
            "signature": sign(USER, GOOD_TRACE, 2, "trains", "120 km/h"),
        },
    ).json()
    assert free["rewarded"] and verified["rewarded"]
    assert free["answerVerified"] is False
    assert verified["answerVerified"] is True
    assert verified["amount"] > free["amount"]


def test_correct_answer_with_an_unrelated_trace_earns_nothing(client):
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": UNRELATED_TRACE,
            "problemId": "trains",
            "answer": "120",
            "nonce": 1,
            "signature": sign(USER, UNRELATED_TRACE, 1, "trains", "120"),
        },
    )
    assert response.json()["rewarded"] is False
    assert response.json()["score"] == 0


def test_trace_must_use_the_problem_data_and_reach_the_answer():
    trains = PROBLEMS["trains"]
    assert addresses_problem(trains, GOOD_TRACE)
    assert not addresses_problem(trains, UNRELATED_TRACE)
    assert not addresses_problem(trains, GOOD_TRACE.replace("120", "cien"))
    assert addresses_problem(PROBLEMS["compound"], "1000 al 10% da 1.331,00 al final")


def test_free_form_signature_cannot_be_upgraded_to_a_verified_claim(client, chain):
    """The signed claim covers the answer, so a free-form authorization cannot be
    replayed with a correct answer bolted on to collect the verified reward."""
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "problemId": "trains",
            "answer": "120",
            "nonce": 3,
            "signature": sign(USER, GOOD_TRACE, 3),
        },
    )
    assert response.status_code == 401


def test_nonce_cannot_be_replayed(client, chain):
    body = {
        "user": USER.address,
        "reasoning": GOOD_TRACE,
        "nonce": 5,
        "signature": sign(USER, GOOD_TRACE, 5),
    }
    assert client.post("/evaluate", json=body).json()["rewarded"] is True
    assert client.post("/evaluate", json=body).status_code == 409


def test_duplicate_cid_is_refused(client, chain):
    from web3 import Web3

    chain.rewarded.add(Web3.keccak(text=deterministic_cid(GOOD_TRACE)))
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "nonce": 9,
            "signature": sign(USER, GOOD_TRACE, 9),
        },
    )
    assert response.status_code == 409


def test_unpinned_response_does_not_advertise_a_gateway(client, chain):
    response = client.post(
        "/evaluate",
        json={
            "user": USER.address,
            "reasoning": GOOD_TRACE,
            "nonce": 11,
            "signature": sign(USER, GOOD_TRACE, 11),
        },
    ).json()
    assert response["cidPinned"] is False
    assert response["cidUrl"] is None


def test_answer_checking_accepts_formatting_but_not_wrong_values():
    trains = PROBLEMS["trains"]
    assert check_answer(trains, " 120 ")
    assert check_answer(trains, "120 km/h")
    assert check_answer(trains, "120.0")
    assert not check_answer(trains, "121")
    assert not check_answer(trains, "ciento veinte")
    assert not check_answer(trains, "")


def test_repeated_padding_scores_far_below_real_reasoning():
    padded = "\n".join(["- por lo tanto por lo tanto por lo tanto"] * 30)
    assert main.score_reasoning(padded) < main.score_reasoning(GOOD_TRACE) / 2


def test_problems_endpoint_lists_caps(client):
    body = client.get("/problems").json()
    assert {p["id"] for p in body["problems"]} == set(PROBLEMS)
    assert body["verifiedMaxCogn"] > body["freeformMaxCogn"]


def test_claim_payload_endpoint_returns_signable_typed_data(client):
    body = client.post(
        "/claim-payload", json={"user": USER.address, "reasoning": GOOD_TRACE}
    ).json()
    encoded = encode_typed_data(
        domain_data=body["typedData"]["domain"],
        message_types=body["typedData"]["types"],
        message_data=body["typedData"]["message"],
    )
    signature = USER.sign_message(encoded).signature.hex()
    assert (
        recover_claim_signer(
            USER.address,
            GOOD_TRACE,
            None,
            None,
            body["nonce"],
            signature,
            main.CHAIN_ID,
            main.TOKEN_ADDRESS,
        )
        == USER.address
    )
