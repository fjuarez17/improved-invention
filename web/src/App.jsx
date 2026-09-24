import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, formatEther } from "ethers";
import {
  EXPLORER,
  MONAD_TESTNET,
  ORACLE_API,
  TOKEN_ABI,
  TOKEN_ADDRESS,
  VESTING_ABI,
  VESTING_ADDRESS,
} from "./config";
import "./App.css";

const readProvider = new JsonRpcProvider(MONAD_TESTNET.rpcUrls[0]);
const fmt = (v, digits = 2) =>
  Number(formatEther(v)).toLocaleString("en-US", { maximumFractionDigits: digits });
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const SAMPLE = `Para calcular la derivada de f(x) = x^2 * ln(x):
1. Identifico un producto de dos funciones, u = x^2 y v = ln(x).
2. Aplico la regla del producto: f' = u'v + uv'.
3. Derivo cada parte: u' = 2x y v' = 1/x.
4. Sustituyo: f' = 2x*ln(x) + x^2*(1/x).
5. Simplifico el segundo termino: x^2/x = x.
Por lo tanto f'(x) = 2x*ln(x) + x, y el dominio sigue siendo x > 0.`;

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState(null);
  const [balance, setBalance] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [reasoning, setReasoning] = useState(SAMPLE);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const token = new Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider);
  const vesting = new Contract(VESTING_ADDRESS, VESTING_ABI, readProvider);

  const loadStats = useCallback(async () => {
    const [maxSupply, totalSupply, mining, mined, oracle, maxReward] = await Promise.all([
      token.MAX_SUPPLY(),
      token.totalSupply(),
      token.MINING_ALLOCATION(),
      token.totalMined(),
      token.oracleAddress(),
      token.maxRewardPerMint(),
    ]);
    setStats({ maxSupply, totalSupply, mining, mined, oracle, maxReward });

    const count = Number(await vesting.scheduleCount());
    const list = [];
    for (let id = 0; id < count; id++) {
      const [s, vested, releasable] = await Promise.all([
        vesting.getSchedule(id),
        vesting.vestedAmount(id),
        vesting.releasableAmount(id),
      ]);
      list.push({ id, s, vested, releasable });
    }
    setSchedules(list);
  }, []);

  const loadRewards = useCallback(async () => {
    const latest = await readProvider.getBlockNumber();
    const logs = await token.queryFilter(token.filters.CognitiveRewardMinted(), latest - 9000, latest);
    setRewards(logs.slice(-8).reverse());
  }, []);

  useEffect(() => {
    loadStats().catch((e) => setError(e.message));
    loadRewards().catch(() => {});
    const timer = setInterval(() => loadStats().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [loadStats, loadRewards]);

  const loadBalance = useCallback(async (address) => {
    setBalance(await token.balanceOf(address));
  }, []);

  async function connect() {
    setError(null);
    if (!window.ethereum) {
      setError("Instala MetaMask para conectar tu wallet.");
      return;
    }
    const provider = new BrowserProvider(window.ethereum);
    const [address] = await provider.send("eth_requestAccounts", []);
    try {
      await provider.send("wallet_switchEthereumChain", [{ chainId: MONAD_TESTNET.chainIdHex }]);
    } catch {
      await provider.send("wallet_addEthereumChain", [
        {
          chainId: MONAD_TESTNET.chainIdHex,
          chainName: MONAD_TESTNET.chainName,
          nativeCurrency: MONAD_TESTNET.nativeCurrency,
          rpcUrls: MONAD_TESTNET.rpcUrls,
          blockExplorerUrls: MONAD_TESTNET.blockExplorerUrls,
        },
      ]);
    }
    setAccount(address);
    loadBalance(address);
  }

  async function submitReasoning() {
    if (!account) return connect();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${ORACLE_API}/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: account, reasoning }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "oracle error");
      setResult(data);
      await Promise.all([loadStats(), loadBalance(account), loadRewards()]);
    } catch (e) {
      setError(`Oráculo: ${e.message}. ¿Está corriendo \`npm run oracle\`?`);
    } finally {
      setBusy(false);
    }
  }

  async function claim(id) {
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(VESTING_ADDRESS, VESTING_ABI, await provider.getSigner());
    await (await contract.release(id)).wait();
    await loadStats();
  }

  const minedPct = stats ? Number((stats.mined * 10000n) / stats.mining) / 100 : 0;

  return (
    <div className="app">
      <header>
        <div>
          <h1>
            CalchAI <span>$COGN</span>
          </h1>
          <p className="tagline">Proof of Reasoning · mercado descentralizado de datos de razonamiento · Monad Testnet</p>
        </div>
        <button className="primary" onClick={connect}>
          {account ? short(account) : "Conectar wallet"}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        <Stat label="Hard cap" value={stats ? `${fmt(stats.maxSupply, 0)} COGN` : "…"} sub="inmutable en el contrato" />
        <Stat label="Supply actual" value={stats ? `${fmt(stats.totalSupply, 0)} COGN` : "…"} sub="600M TGE + minado" />
        <Stat
          label="Minería cognitiva"
          value={stats ? `${fmt(stats.mined, 2)} / ${fmt(stats.mining, 0)}` : "…"}
          sub="sólo se emite con razonamiento validado"
        />
        <Stat
          label="Tu balance"
          value={balance !== null ? `${fmt(balance, 4)} COGN` : account ? "…" : "conecta tu wallet"}
        />
      </section>

      <div className="bar">
        <div className="bar-fill" style={{ width: `${Math.max(minedPct, 0.5)}%` }} />
        <span>{minedPct.toFixed(4)}% de los 400M minados</span>
      </div>

      <section className="panel">
        <h2>1 · Gana $COGN razonando</h2>
        <p className="hint">
          El oráculo de CalchAI puntúa la traza, la ancla a IPFS y acuña la recompensa. Ninguna otra wallet puede
          emitir: oráculo on-chain{" "}
          <a href={`${EXPLORER}/address/${stats?.oracle ?? ""}`} target="_blank" rel="noreferrer">
            {stats ? short(stats.oracle) : "…"}
          </a>
          .
        </p>
        <textarea rows={10} value={reasoning} onChange={(e) => setReasoning(e.target.value)} />
        <button className="primary" onClick={submitReasoning} disabled={busy}>
          {busy ? "Evaluando razonamiento…" : "Enviar al oráculo"}
        </button>

        {result && (
          <div className={result.rewarded ? "result ok" : "result warn"}>
            {result.rewarded ? (
              <>
                <strong>Score {result.score}/100 → {result.amount} COGN</strong>
                <div className="mono">CID: {result.cid}</div>
                <a href={result.explorer} target="_blank" rel="noreferrer">
                  Ver recibo en el explorer ↗
                </a>
              </>
            ) : (
              <>
                <strong>Score {result.score}/100 — sin recompensa</strong>
                <div>{result.reason}</div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>2 · Vesting: nadie puede hacer dump</h2>
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Total</th>
              <th>Desbloqueado</th>
              <th>Reclamable</th>
              <th>Cliff</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schedules.map(({ id, s, vested, releasable }) => {
              const cliffEnd = new Date((Number(s.start) + Number(s.cliff)) * 1000);
              return (
                <tr key={id}>
                  <td>{s.category}</td>
                  <td>{fmt(s.total, 0)}</td>
                  <td>
                    {fmt(vested, 0)} <span className="muted">({((Number(vested) / Number(s.total)) * 100).toFixed(1)}%)</span>
                  </td>
                  <td>{fmt(releasable, 0)}</td>
                  <td>{cliffEnd.toLocaleDateString("es-ES")}</td>
                  <td>
                    <button disabled={releasable === 0n || !account} onClick={() => claim(id)}>
                      Reclamar
                    </button>
                  </td>
                </tr>
              );
            })}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Cargando calendarios on-chain…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>3 · Recibos de razonamiento recientes</h2>
        <ul className="rewards">
          {rewards.map((log) => (
            <li key={log.transactionHash}>
              <span className="mono">{short(log.args[0])}</span>
              <span>{fmt(log.args[1], 2)} COGN</span>
              <span className="mono cid">{log.args[2].slice(0, 22)}…</span>
              <a href={`${EXPLORER}/tx/${log.transactionHash}`} target="_blank" rel="noreferrer">
                tx ↗
              </a>
            </li>
          ))}
          {rewards.length === 0 && <li className="muted">Todavía no hay recompensas en los últimos bloques.</li>}
        </ul>
      </section>

      <footer>
        <a href={`${EXPLORER}/address/${TOKEN_ADDRESS}`} target="_blank" rel="noreferrer">
          Token {short(TOKEN_ADDRESS)} ↗
        </a>
        <a href={`${EXPLORER}/address/${VESTING_ADDRESS}`} target="_blank" rel="noreferrer">
          Vesting {short(VESTING_ADDRESS)} ↗
        </a>
      </footer>
    </div>
  );
}
