import { parseUnits } from "ethers/lib/utils";

import { CFEntry, OffboardEntry } from "../types";

export const COMPTROLLER = "0x687a01ecF6d3907658f7A7c714749fAC32336D1B";

// Core Pool markets with CF > 0. CF and LT each reduced by 2 percentage points.
export const cfChanges: CFEntry[] = [
  {
    symbol: "vWBTC_Core",
    vToken: "0x8716554364f20BCA783cb2BAA744d39361fd1D8d",
    oldCF: parseUnits("0.75", 18),
    newCF: parseUnits("0.73", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vWETH_Core",
    vToken: "0x7c8ff7d2A1372433726f879BD945fFb250B94c65",
    oldCF: parseUnits("0.75", 18),
    newCF: parseUnits("0.73", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vUSDC_Core",
    vToken: "0x17C07e0c232f2f80DfDbd7a95b942D893A4C5ACb",
    oldCF: parseUnits("0.78", 18),
    newCF: parseUnits("0.76", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vUSDT_Core",
    vToken: "0x8C3e3821259B82fFb32B2450A95d2dcbf161C24E",
    oldCF: parseUnits("0.78", 18),
    newCF: parseUnits("0.76", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "veBTC",
    vToken: "0x325cEB02fe1C2fF816A83a5770eA0E88e2faEcF2",
    oldCF: parseUnits("0.68", 18),
    newCF: parseUnits("0.66", 18),
    oldLT: parseUnits("0.72", 18),
    newLT: parseUnits("0.7", 18),
  },
  {
    symbol: "vLBTC_Core",
    vToken: "0x25C20e6e110A1cE3FEbaCC8b7E48368c7b2F0C91",
    oldCF: parseUnits("0.735", 18),
    newCF: parseUnits("0.715", 18),
    oldLT: parseUnits("0.785", 18),
    newLT: parseUnits("0.765", 18),
  },
  {
    symbol: "vUSDS_Core",
    vToken: "0x0c6B19287999f1e31a5c0a44393b24B62D2C0468",
    oldCF: parseUnits("0.73", 18),
    newCF: parseUnits("0.71", 18),
    oldLT: parseUnits("0.75", 18),
    newLT: parseUnits("0.73", 18),
  },
  {
    symbol: "vsUSDS_Core",
    vToken: "0xE36Ae842DbbD7aE372ebA02C8239cd431cC063d6",
    oldCF: parseUnits("0.73", 18),
    newCF: parseUnits("0.71", 18),
    oldLT: parseUnits("0.75", 18),
    newLT: parseUnits("0.73", 18),
  },
  {
    symbol: "vweETHs_Core",
    vToken: "0xc42E4bfb996ED35235bda505430cBE404Eb49F77",
    oldCF: parseUnits("0.7", 18),
    newCF: parseUnits("0.68", 18),
    oldLT: parseUnits("0.75", 18),
    newLT: parseUnits("0.73", 18),
  },
  {
    symbol: "vsUSDe_Core",
    vToken: "0xa836ce315b7A6Bb19397Ee996551659B1D92298e",
    oldCF: parseUnits("0.72", 18),
    newCF: parseUnits("0.7", 18),
    oldLT: parseUnits("0.75", 18),
    newLT: parseUnits("0.73", 18),
  },
  {
    symbol: "vtBTC_Core",
    vToken: "0x5e35C312862d53FD566737892aDCf010cb4928F7",
    oldCF: parseUnits("0.75", 18),
    newCF: parseUnits("0.73", 18),
    oldLT: parseUnits("0.78", 18),
    newLT: parseUnits("0.76", 18),
  },
];

// crvUSD off-board: CF already 0; pause all actions and zero both caps.
export const crvUSDOffboard: OffboardEntry = {
  symbol: "crvUSD",
  vToken: "0x672208C10aaAA2F9A6719F449C4C8227bc0BC202",
  oldSupplyCap: "5000000000000000000000000",
  oldBorrowCap: "4000000000000000000000000",
};
