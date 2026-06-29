import { ethers } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bscmainnet } = NETWORK_ADDRESSES;

// Oracle infrastructure (resolved via NETWORK_ADDRESSES / verified on-chain).
export const BINANCE_ORACLE = bscmainnet.BINANCE_ORACLE; // 0x594810b741d136f1960141C0d8Fb4a91bE78A820
export const RESILIENT_ORACLE = bscmainnet.RESILIENT_ORACLE; // 0x6592b5DE802159F3E74B2486b091D11a8256ab8A
// Not present in NETWORK_ADDRESSES; verified on-chain (ResilientOracle.boundValidator()).
export const BOUND_VALIDATOR = "0x6E332fF0bB52475304494E4AE5063c1051c7d735";

// Main oracle adapters that keep their existing slot for these markets.
const CL = bscmainnet.CHAINLINK_ORACLE; // 0x1B2103441A0A108daD8848D8F5d790e4D402921F
const RS = bscmainnet.REDSTONE_ORACLE; // 0x8455EFA4D7Ff63b8BFD96AdD889483Ea7d39B70a
const ASBNB_ORACLE = "0x652B90D1d45a7cD5BE82c5Fb61a4A00bA126dde5"; // AsBNBOracle
const SOLVBTC_ONEJUMP_CHAINLINK_ORACLE = "0x3f4bC081E749032cffF29dcA2E8408Ec375e745A"; // OneJumpOracle (Chainlink)
const WBETH_ORACLE = "0x49938fc72262c126eb5D4BdF6430C55189AEB2BA"; // WBETHOracle

// BoundValidator anchor bounds applied to every market: ±5%.
export const UPPER_BOUND = parseUnits("1.05", 18);
export const LOWER_BOUND = parseUnits("0.95", 18);

// Binance feed symbol override re-affirmed by this VIP (already configured on-chain).
export const CAKE_SYMBOL_OVERRIDE: [string, string] = ["Cake", "CAKE"];

export interface AssetConfig {
  symbol: string;
  asset: string;
  // Symbol used to key the Binance Oracle feed/maxStalePeriod (after any symbol override).
  binanceSymbol: string;
  // Existing MAIN oracle, kept exactly as it is on-chain.
  mainOracle: string;
  // Binance Oracle heartbeat for this symbol, in seconds.
  maxStalePeriod: number;
}

// MAIN oracle for each market read from its live ResilientOracle config; PIVOT becomes Binance,
// FALLBACK is left empty, with enable flags [main, pivot, fallback] = [true, true, false].
export const ASSETS: AssetConfig[] = [
  {
    symbol: "AAVE",
    asset: "0xfb6115445Bff7b52FeB98650C87f44907E58f802",
    binanceSymbol: "AAVE",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "ADA",
    asset: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47",
    binanceSymbol: "ADA",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "asBNB",
    asset: "0x77734e70b6E88b4d82fE632a168EDf6e700912b6",
    binanceSymbol: "asBNB",
    mainOracle: ASBNB_ORACLE,
    maxStalePeriod: 90000,
  },
  {
    symbol: "BCH",
    asset: "0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf",
    binanceSymbol: "BCH",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "CAKE",
    asset: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    binanceSymbol: "CAKE",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "DAI",
    asset: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    binanceSymbol: "DAI",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "DOGE",
    asset: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43",
    binanceSymbol: "DOGE",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "DOT",
    asset: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402",
    binanceSymbol: "DOT",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "FDUSD",
    asset: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
    binanceSymbol: "FDUSD",
    mainOracle: CL,
    maxStalePeriod: 1200,
  },
  {
    symbol: "FIL",
    asset: "0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153",
    binanceSymbol: "FIL",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "LINK",
    asset: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
    binanceSymbol: "LINK",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "LTC",
    asset: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94",
    binanceSymbol: "LTC",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "SOL",
    asset: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF",
    binanceSymbol: "SOL",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "SolvBTC",
    asset: "0x4aae823a6a0b376De6A78e74eCC5b079d38cBCf7",
    binanceSymbol: "SolvBTC",
    mainOracle: SOLVBTC_ONEJUMP_CHAINLINK_ORACLE,
    maxStalePeriod: 46800,
  },
  {
    symbol: "THE",
    asset: "0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11",
    binanceSymbol: "THE",
    mainOracle: RS,
    maxStalePeriod: 90000,
  },
  {
    symbol: "TUSD",
    asset: "0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9",
    binanceSymbol: "TUSD",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "UNI",
    asset: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1",
    binanceSymbol: "UNI",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "VAI",
    asset: "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7",
    binanceSymbol: "VAI",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "WBETH",
    asset: "0xa2E3356610840701BDf5611a53974510Ae27E2e1",
    binanceSymbol: "WBETH",
    mainOracle: WBETH_ORACLE,
    maxStalePeriod: 1200,
  },
  {
    symbol: "XRP",
    asset: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
    binanceSymbol: "XRP",
    mainOracle: CL,
    maxStalePeriod: 90000,
  },
  {
    symbol: "XVS",
    asset: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
    binanceSymbol: "XVS",
    mainOracle: CL,
    maxStalePeriod: 1200,
  },
];

// ResilientOracle slot order: [MAIN (unchanged), PIVOT (Binance), FALLBACK (empty)].
export const pivotOracles = (asset: AssetConfig): [string, string, string] => [
  asset.mainOracle,
  BINANCE_ORACLE,
  ethers.constants.AddressZero,
];
export const PIVOT_FLAGS: [boolean, boolean, boolean] = [true, true, false];

export const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain] Add Binance Oracle as PIVOT for 21 Core Pool markets",
    description: `#### Summary

This VIP restores the Binance Oracle as the PIVOT (sanity-check) source for ${ASSETS.length} BNB Chain Core Pool markets. For each market the existing MAIN oracle is kept exactly as configured on-chain, the FALLBACK slot is left empty, and the Binance Oracle is set as the PIVOT with enable flags [MAIN, PIVOT, FALLBACK] = [true, true, false].

For every market the proposal also:
- sets the Binance Oracle \`maxStalePeriod\` for the asset's symbol to its heartbeat, and
- sets the BoundValidator anchor configuration to upper bound 1.05 and lower bound 0.95.

The Binance feed symbol override "Cake" → "CAKE" is re-affirmed.

#### Details

- 1 Binance Oracle \`setSymbolOverride\` ("Cake" → "CAKE").
- ${ASSETS.length} Binance Oracle \`setMaxStalePeriod\` calls (one per symbol).
- 1 BoundValidator \`setValidateConfigs\` call configuring ${ASSETS.length} markets with bounds 0.95 / 1.05.
- 1 ResilientOracle \`setTokenConfigs\` call updating ${ASSETS.length} markets to [MAIN unchanged, Binance PIVOT, empty FALLBACK].

#### Voting options

- **For** — Execute this proposal
- **Against** — Do not execute this proposal
- **Abstain** — Indifferent to execution`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      // =====================================================================================
      // Binance Oracle — symbol override + per-symbol max stale periods
      // =====================================================================================
      {
        target: BINANCE_ORACLE,
        signature: "setSymbolOverride(string,string)",
        params: [CAKE_SYMBOL_OVERRIDE[0], CAKE_SYMBOL_OVERRIDE[1]],
      },
      ...ASSETS.map(asset => ({
        target: BINANCE_ORACLE,
        signature: "setMaxStalePeriod(string,uint256)",
        params: [asset.binanceSymbol, asset.maxStalePeriod],
      })),

      // =====================================================================================
      // BoundValidator — anchor bounds (±5%) required to enable a PIVOT
      // =====================================================================================
      {
        target: BOUND_VALIDATOR,
        signature: "setValidateConfigs((address,uint256,uint256)[])",
        params: [ASSETS.map(asset => [asset.asset, UPPER_BOUND, LOWER_BOUND])],
      },

      // =====================================================================================
      // ResilientOracle — add Binance as PIVOT, keep MAIN, empty FALLBACK
      // =====================================================================================
      {
        target: RESILIENT_ORACLE,
        signature: "setTokenConfigs((address,address[3],bool[3],bool)[])",
        params: [ASSETS.map(asset => [asset.asset, pivotOracles(asset), PIVOT_FLAGS, false])],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
