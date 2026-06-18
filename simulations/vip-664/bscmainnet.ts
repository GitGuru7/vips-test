import { TransactionResponse } from "@ethersproject/providers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { expectEvents } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import { COMPTROLLER, NEW_USDT_SUPPLY_CAP, OLD_USDT_SUPPLY_CAP, vUSDT, vip664 } from "../../vips/vip-664/bscmainnet";
import COMPTROLLER_ABI from "./abi/comptroller.json";

forking(104900000, async () => {
  const provider = ethers.provider;
  let corePoolComptroller: Contract;

  before(async () => {
    corePoolComptroller = new ethers.Contract(COMPTROLLER, COMPTROLLER_ABI, provider);
  });

  describe("Pre-VIP behavior", () => {
    it("Verify USDT supply cap is 600M", async () => {
      const usdtSupplyCap = await corePoolComptroller.supplyCaps(vUSDT);
      expect(usdtSupplyCap).equals(OLD_USDT_SUPPLY_CAP);
    });
  });

  testVip("VIP-664 Set USDT supply cap to 320M", await vip664(), {
    callbackAfterExecution: async (txResponse: TransactionResponse) => {
      await expectEvents(txResponse, [COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
    },
  });

  describe("Post-VIP behavior", () => {
    it("Verify USDT supply cap is 320M", async () => {
      const usdtSupplyCap = await corePoolComptroller.supplyCaps(vUSDT);
      expect(usdtSupplyCap).equals(NEW_USDT_SUPPLY_CAP);
    });
  });
});
