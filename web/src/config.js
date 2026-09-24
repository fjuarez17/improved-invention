export const MONAD_TESTNET = {
  chainIdHex: "0x279f",
  chainId: 10143,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz/"],
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
};

export const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS || "0x3721E5c3162FEA106ddC42baBAcEF09664EF625F";
export const VESTING_ADDRESS = import.meta.env.VITE_VESTING_ADDRESS || "0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A";
export const ORACLE_API = import.meta.env.VITE_ORACLE_API || "http://localhost:8787";
export const EXPLORER = MONAD_TESTNET.blockExplorerUrls[0];

export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MINING_ALLOCATION() view returns (uint256)",
  "function totalMined() view returns (uint256)",
  "function remainingMiningSupply() view returns (uint256)",
  "function oracleAddress() view returns (address)",
  "function maxRewardPerMint() view returns (uint256)",
  "event CognitiveRewardMinted(address indexed user, uint256 amount, string reasoningCid)",
];

export const VESTING_ABI = [
  "function scheduleCount() view returns (uint256)",
  "function getSchedule(uint256) view returns (tuple(address beneficiary,uint256 total,uint256 tgeAmount,uint256 released,uint64 start,uint64 cliff,uint64 duration,string category))",
  "function vestedAmount(uint256) view returns (uint256)",
  "function releasableAmount(uint256) view returns (uint256)",
  "function release(uint256)",
];
