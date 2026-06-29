import { SeedCommand, getAuxiliaryAggregator } from "src/auxiliaryCommandsAggregator";
import { NETWORK_ADDRESSES } from "src/networkAddresses";

import * as arb from "../data/arbitrumone";
import * as base from "../data/basemainnet";
import * as eth from "../data/ethereum";

export type RemoteChainKey = "ethereum" | "arbitrumone" | "basemainnet";

export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Comptroller signatures the aggregator must be granted to run the batch.
const SET_CF = "setCollateralFactor(address,uint256,uint256)";
const SET_SUPPLY_CAPS = "setMarketSupplyCaps(address[],uint256[])";
const SET_BORROW_CAPS = "setMarketBorrowCaps(address[],uint256[])";
// The ACM permission for setActionsPaused is registered with the uint256[] form (the Comptroller's
// hardcoded permission string), while the actual call must use the uint8[] form so the selector and
// enum encoding match. They differ, so the grant and the call use different signature strings.
const SET_ACTIONS_PAUSED_PERMISSION = "setActionsPaused(address[],uint256[],bool)";
const SET_ACTIONS_PAUSED_CALL = "setActionsPaused(address[],uint8[],bool)";

// All nine Comptroller actions, paused on a full off-board.
const ALL_ACTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const DATA: Record<RemoteChainKey, { comptroller: string; cfChanges: typeof eth.cfChanges }> = {
  ethereum: { comptroller: eth.COMPTROLLER, cfChanges: eth.cfChanges },
  arbitrumone: { comptroller: arb.COMPTROLLER, cfChanges: arb.cfChanges },
  basemainnet: { comptroller: base.COMPTROLLER, cfChanges: base.cfChanges },
};

// Build the ordered batch executed by the aggregator on a remote chain:
// grant the aggregator each needed permission, apply the CF/LT recalibration (and the
// Ethereum crvUSD off-board), revoke those permissions, then self-revoke the admin role.
export function buildSeedBatch(chainKey: RemoteChainKey): SeedCommand[] {
  const { ACCESS_CONTROL_MANAGER: acm } = NETWORK_ADDRESSES[chainKey];
  const aggregator = getAuxiliaryAggregator(chainKey);
  const { comptroller, cfChanges } = DATA[chainKey];

  const grant = (signature: string): SeedCommand => ({
    target: acm,
    signature: "giveCallPermission(address,string,address)",
    params: [comptroller, signature, aggregator],
  });
  const revoke = (signature: string): SeedCommand => ({
    target: acm,
    signature: "revokeCallPermission(address,string,address)",
    params: [comptroller, signature, aggregator],
  });

  const usedSigs =
    chainKey === "ethereum" ? [SET_CF, SET_ACTIONS_PAUSED_PERMISSION, SET_SUPPLY_CAPS, SET_BORROW_CAPS] : [SET_CF];

  const commands: SeedCommand[] = [...usedSigs.map(grant)];

  for (const c of cfChanges) {
    commands.push({ target: comptroller, signature: SET_CF, params: [c.vToken, c.newCF, c.newLT] });
  }

  if (chainKey === "ethereum") {
    const { vToken } = eth.crvUSDOffboard;
    commands.push(
      { target: comptroller, signature: SET_ACTIONS_PAUSED_CALL, params: [[vToken], ALL_ACTIONS, true] },
      { target: comptroller, signature: SET_SUPPLY_CAPS, params: [[vToken], ["0"]] },
      { target: comptroller, signature: SET_BORROW_CAPS, params: [[vToken], ["0"]] },
    );
  }

  commands.push(...usedSigs.map(revoke));

  // Self-revoke: during executeBatch the aggregator still holds DEFAULT_ADMIN_ROLE, so it
  // can revoke its own admin role as the final batch entry (saves a direct VIP command).
  commands.push({ target: acm, signature: "revokeRole(bytes32,address)", params: [DEFAULT_ADMIN_ROLE, aggregator] });

  return commands;
}
