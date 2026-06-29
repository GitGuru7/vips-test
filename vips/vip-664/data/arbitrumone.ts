import { parseUnits } from "ethers/lib/utils";

import { CFEntry } from "../types";

export const COMPTROLLER = "0x317c1A5739F39046E20b08ac9BeEa3f10fD43326";

// Core Pool markets with CF > 0. CF and LT each reduced by 2 percentage points.
export const cfChanges: CFEntry[] = [
  {
    symbol: "vWBTC_Core",
    vToken: "0xaDa57840B372D4c28623E87FC175dE8490792811",
    oldCF: parseUnits("0.75", 18),
    newCF: parseUnits("0.73", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vWETH_Core",
    vToken: "0x68a34332983f4Bf866768DD6D6E638b02eF5e1f0",
    oldCF: parseUnits("0.75", 18),
    newCF: parseUnits("0.73", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vUSDC_Core",
    vToken: "0x7D8609f8da70fF9027E9bc5229Af4F6727662707",
    oldCF: parseUnits("0.78", 18),
    newCF: parseUnits("0.76", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vUSDT_Core",
    vToken: "0xB9F9117d4200dC296F9AcD1e8bE1937df834a2fD",
    oldCF: parseUnits("0.78", 18),
    newCF: parseUnits("0.76", 18),
    oldLT: parseUnits("0.8", 18),
    newLT: parseUnits("0.78", 18),
  },
  {
    symbol: "vARB_Core",
    vToken: "0xAeB0FEd69354f34831fe1D16475D9A83ddaCaDA6",
    oldCF: parseUnits("0.25", 18),
    newCF: parseUnits("0.23", 18),
    oldLT: parseUnits("0.6", 18),
    newLT: parseUnits("0.58", 18),
  },
  {
    symbol: "vgmWETH-USDC_Core",
    vToken: "0x9bb8cEc9C0d46F53b4f2173BB2A0221F66c353cC",
    oldCF: parseUnits("0.7", 18),
    newCF: parseUnits("0.68", 18),
    oldLT: parseUnits("0.75", 18),
    newLT: parseUnits("0.73", 18),
  },
  {
    symbol: "vgmBTC-USDC_Core",
    vToken: "0x4f3a73f318C5EA67A86eaaCE24309F29f89900dF",
    oldCF: parseUnits("0.7", 18),
    newCF: parseUnits("0.68", 18),
    oldLT: parseUnits("0.75", 18),
    newLT: parseUnits("0.73", 18),
  },
];
