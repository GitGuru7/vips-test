import { parseUnits } from "ethers/lib/utils";

import { CFEntry } from "../types";

export const COMPTROLLER = "0x0C7973F9598AA62f9e03B94E92C967fD5437426C";

// Core Pool markets with CF > 0. CF and LT each reduced by 2 percentage points.
export const cfChanges: CFEntry[] = [
  {
    symbol: "vcbBTC_Core",
    vToken: "0x7bBd1005bB24Ec84705b04e1f2DfcCad533b6D72",
    oldCF: parseUnits("0.73", 18),
    newCF: parseUnits("0.71", 18),
    oldLT: parseUnits("0.78", 18),
    newLT: parseUnits("0.76", 18),
  },
  {
    symbol: "vWETH_Core",
    vToken: "0xEB8A79bD44cF4500943bf94a2b4434c95C008599",
    oldCF: parseUnits("0.8", 18),
    newCF: parseUnits("0.78", 18),
    oldLT: parseUnits("0.83", 18),
    newLT: parseUnits("0.81", 18),
  },
  {
    symbol: "vUSDC_Core",
    vToken: "0x3cb752d175740043Ec463673094e06ACDa2F9a2e",
    oldCF: parseUnits("0.75", 18),
    newCF: parseUnits("0.73", 18),
    oldLT: parseUnits("0.78", 18),
    newLT: parseUnits("0.76", 18),
  },
  {
    symbol: "vwstETH_Core",
    vToken: "0x133d3BCD77158D125B75A17Cb517fFD4B4BE64C5",
    oldCF: parseUnits("0.785", 18),
    newCF: parseUnits("0.765", 18),
    oldLT: parseUnits("0.81", 18),
    newLT: parseUnits("0.79", 18),
  },
];
