import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { LzChainId, ProposalType } from "src/types";
import { makeProposal } from "src/utils";

import { getAuxiliaryAggregator } from "../../src/auxiliaryCommandsAggregator";
import * as bsc from "./data/bscmainnet";
import { DEFAULT_ADMIN_ROLE, RemoteChainKey } from "./utils/seed-batch";

const DST_CHAIN_ID: Record<RemoteChainKey, LzChainId> = {
  ethereum: LzChainId.ethereum,
  arbitrumone: LzChainId.arbitrumone,
  basemainnet: LzChainId.basemainnet,
};

// Each remote chain's batch is seeded at index 0 on its (post-VIP-628) aggregator,
// whose batchCount is 0. Verified on-chain before authoring.
export const BATCH_INDEX: Record<RemoteChainKey, number> = {
  ethereum: 0,
  arbitrumone: 0,
  basemainnet: 0,
};

// Cross-chain: grant the aggregator the ACM admin role, run its pre-seeded batch (which
// self-revokes the admin role as its last call), via LayerZero.
function remoteChainCommands(chainKey: RemoteChainKey) {
  const { ACCESS_CONTROL_MANAGER } = NETWORK_ADDRESSES[chainKey];
  const aggregator = getAuxiliaryAggregator(chainKey);
  const dstChainId = DST_CHAIN_ID[chainKey];
  return [
    {
      target: ACCESS_CONTROL_MANAGER,
      signature: "grantRole(bytes32,address)",
      params: [DEFAULT_ADMIN_ROLE, aggregator],
      dstChainId,
    },
    { target: aggregator, signature: "executeBatch(uint256)", params: [BATCH_INDEX[chainKey]], dstChainId },
  ];
}

const meta = {
  version: "v2",
  title: "VIP-664 [Multichain] Core Pool Collateral Factor Recalibration (-2pp) & Asset Off-boarding",
  description: `#### Summary

This proposal applies a protocol-wide, uniform 2 percentage-point reduction to both the collateral
factor (CF) and the liquidation threshold (LT) of every Core Pool market that currently has a non-zero
collateral factor, and off-boards two assets. CF ≤ LT ordering is preserved on every market.

#### Collateral factor recalibration (-2pp on CF and LT)

- **BNB Chain Core Pool** — ${bsc.cfChanges.length} regular markets and ${bsc.emodeCfChanges.length} eMode (poolId-scoped) market entries.
- **Ethereum Core Pool** — 11 markets (executed via the chain's CommandsAggregator).
- **Arbitrum One Core Pool** — 7 markets (executed via the chain's CommandsAggregator).
- **Base Core Pool** — 4 markets (executed via the chain's CommandsAggregator).

The BNB Chain Isolated Pools (DeFi, GameFi, Stablecoins, Liquid Staked BNB, Tron, Meme) and the
Optimism and Unichain Core Pools were enumerated on-chain and currently carry a zero collateral factor
on every market, so they contain no qualifying markets and are unchanged by this proposal.

#### Asset off-boarding

- **Ethereum — crvUSD**: its collateral factor is already 0; this proposal pauses all nine market
  actions and sets its supply and borrow caps to 0 (executed via the Ethereum CommandsAggregator).
- **Arbitrum One — ARB**: borrowing was already off-boarded by the prior risk update (Borrow paused and
  borrow cap already 0); ARB additionally receives the -2pp CF/LT recalibration in this proposal.

#### Execution

BNB Chain commands are issued directly. Ethereum, Arbitrum One and Base changes are pre-seeded into each
chain's AuxiliaryCommandsAggregator; for each, the proposal grants the aggregator the ACM default-admin
role and calls executeBatch, and the batch self-revokes the admin role as its final call.

#### Voting options

- **For** — Execute this proposal
- **Against** — Do not execute this proposal
- **Abstain** — Indifferent to execution`,
  forDescription: "I agree that Venus Protocol should proceed with this proposal",
  againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
  abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
};

export const vip664 = () =>
  makeProposal(
    [
      // ──────────────────────────────────────────────────────────────────────────
      // BNB Chain Core Pool — regular markets
      // ──────────────────────────────────────────────────────────────────────────
      ...bsc.cfChanges.map(c => ({
        target: bsc.COMPTROLLER,
        signature: "setCollateralFactor(address,uint256,uint256)",
        params: [c.vToken, c.newCF, c.newLT],
      })),

      // ──────────────────────────────────────────────────────────────────────────
      // BNB Chain Core Pool — eMode pools
      // ──────────────────────────────────────────────────────────────────────────
      ...bsc.emodeCfChanges.map(c => ({
        target: bsc.COMPTROLLER,
        signature: "setCollateralFactor(uint96,address,uint256,uint256)",
        params: [c.poolId, c.vToken, c.newCF, c.newLT],
      })),

      // ──────────────────────────────────────────────────────────────────────────
      // Ethereum Core — via AuxiliaryCommandsAggregator (CF/LT + crvUSD off-board)
      // ──────────────────────────────────────────────────────────────────────────
      ...remoteChainCommands("ethereum"),

      // ──────────────────────────────────────────────────────────────────────────
      // Arbitrum One Core — via AuxiliaryCommandsAggregator
      // ──────────────────────────────────────────────────────────────────────────
      ...remoteChainCommands("arbitrumone"),

      // ──────────────────────────────────────────────────────────────────────────
      // Base Core — via AuxiliaryCommandsAggregator
      // ──────────────────────────────────────────────────────────────────────────
      ...remoteChainCommands("basemainnet"),
    ],
    meta,
    ProposalType.REGULAR,
  );

export default vip664;
