import { expect } from "chai";
import { Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip633, { NEW_SUPPLY_CAP, VUSDT } from "../../vips/vip-633/bscmainnet";
import COMPTROLLER_ABI from "./abi/Comptroller.json";

const { bscmainnet } = NETWORK_ADDRESSES;

// BNB Chain block ~2026-06-17. On-chain vUSDT supply cap at this block is 600M USDT.
const FORK_BLOCK = 99000000;
const CURRENT_SUPPLY_CAP = parseUnits("600000000", 18);

forking(FORK_BLOCK, async () => {
  let comptroller: Contract;

  before(async () => {
    comptroller = new ethers.Contract(bscmainnet.UNITROLLER, COMPTROLLER_ABI, ethers.provider);
  });

  describe("Pre-VIP behavior", () => {
    it("vUSDT supply cap is 600M before execution", async () => {
      expect(await comptroller.supplyCaps(VUSDT)).to.equal(CURRENT_SUPPLY_CAP);
    });
  });

  testVip("VIP-633 [BNB Chain] Set vUSDT Supply Cap to 350M in Core Pool", await vip633(), {
    callbackAfterExecution: async txResponse => {
      await expectEvents(txResponse, [COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
    },
  });

  describe("Post-VIP behavior", () => {
    it("vUSDT supply cap is 350M after execution", async () => {
      expect(await comptroller.supplyCaps(VUSDT)).to.equal(NEW_SUPPLY_CAP);
    });
  });
});
