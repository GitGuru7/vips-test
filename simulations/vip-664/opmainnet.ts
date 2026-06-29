import { expect } from "chai";
import { ethers } from "hardhat";
import { forking } from "src/vip-framework";

import COMPTROLLER_ABI from "./abi/Comptroller.json";

// Optimism Core Pool was enumerated on-chain: every market currently carries a zero
// collateral factor, so there are no qualifying markets for the -2pp recalibration and
// VIP-664 issues no Optimism commands. This proves that exclusion.
const COMPTROLLER = "0x5593FF68bE84C966821eEf5F0a988C285D5B7CeC";

forking(153575000, async () => {
  it("every Optimism Core Pool market has collateral factor 0 (nothing to recalibrate)", async () => {
    const comptroller = new ethers.Contract(COMPTROLLER, COMPTROLLER_ABI, ethers.provider);
    const markets: string[] = await comptroller.getAllMarkets();
    for (const vToken of markets) {
      const md = await comptroller.markets(vToken);
      expect(md.collateralFactorMantissa.toString()).to.equal("0", `${vToken} CF`);
    }
  });
});
