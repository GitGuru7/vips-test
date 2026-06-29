import { BigNumberish } from "ethers";

// A market whose collateral factor and liquidation threshold are both reduced by 2 pp.
export interface CFEntry {
  symbol: string;
  vToken: string;
  oldCF: BigNumberish;
  newCF: BigNumberish;
  oldLT: BigNumberish;
  newLT: BigNumberish;
}

// An eMode (poolId-scoped) collateral-factor entry on the BNB Chain Core Pool diamond.
export interface EmodeCFEntry extends CFEntry {
  poolId: number;
  poolLabel: string;
}

// An asset being off-boarded: all actions paused, both caps set to 0.
export interface OffboardEntry {
  symbol: string;
  vToken: string;
  oldSupplyCap: BigNumberish;
  oldBorrowCap: BigNumberish;
}
