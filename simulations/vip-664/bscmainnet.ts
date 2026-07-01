import { TransactionResponse } from "@ethersproject/providers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import { vUSDT_CORE, vUSDT_CORE_SUPPLY_CAP, vip664 } from "../../vips/vip-664/bscmainnet";
import ERC20_ABI from "./abi/ERC20.json";
import VBEP20_ABI from "./abi/VBep20.json";
import CORE_COMPTROLLER_ABI from "./abi/coreComptroller.json";

const { bscmainnet } = NETWORK_ADDRESSES;

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const OLD_SUPPLY_CAP = parseUnits("600000000", 18);
// Amount a user attempts to supply. The market's total supplied (~211M USDT) already
// exceeds the new 100M cap, so any positive mint must be rejected by the cap.
const MINT_AMOUNT = parseUnits("1000", 18);

forking(96883423, async () => {
  const provider = ethers.provider;
  const coreComptroller = new ethers.Contract(bscmainnet.UNITROLLER, CORE_COMPTROLLER_ABI, provider);

  describe("Pre-VIP behaviour", async () => {
    it("vUSDT supply cap is 600M", async () => {
      expect(await coreComptroller.supplyCaps(vUSDT_CORE)).to.equal(OLD_SUPPLY_CAP);
    });

    it("supplying USDT is allowed under the current 600M cap", async () => {
      const snapshot = await provider.send("evm_snapshot", []);

      // Fund a fresh user with USDT from the vUSDT market's own cash.
      const vUsdtSigner = await initMainnetUser(vUSDT_CORE, parseUnits("1", 18));
      const user = await initMainnetUser("0x0000000000000000000000000000000000000101", parseUnits("1", 18));
      const usdt = new ethers.Contract(USDT, ERC20_ABI, provider);
      const vUsdt = new ethers.Contract(vUSDT_CORE, VBEP20_ABI, user);

      await usdt.connect(vUsdtSigner).transfer(user.address, MINT_AMOUNT);
      await usdt.connect(user).approve(vUSDT_CORE, MINT_AMOUNT);

      await expect(vUsdt.mint(MINT_AMOUNT)).to.not.be.reverted;

      await provider.send("evm_revert", [snapshot]);
    });
  });

  testVip("VIP-664", await vip664(), {
    callbackAfterExecution: async (txResponse: TransactionResponse) => {
      await expectEvents(txResponse, [CORE_COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
    },
  });

  describe("Post-VIP behavior", async () => {
    it("vUSDT supply cap is 100M", async () => {
      expect(await coreComptroller.supplyCaps(vUSDT_CORE)).to.equal(vUSDT_CORE_SUPPLY_CAP);
    });

    it("new cap (100M) is below the current supplied amount", async () => {
      const vUsdt = new ethers.Contract(vUSDT_CORE, VBEP20_ABI, provider);
      const totalSupply: BigNumber = await vUsdt.totalSupply();
      const exchangeRate: BigNumber = await vUsdt.exchangeRateStored();
      const suppliedUnderlying = totalSupply.mul(exchangeRate).div(parseUnits("1", 18));
      expect(suppliedUnderlying).to.be.gt(vUSDT_CORE_SUPPLY_CAP);
    });

    it("supplying USDT now reverts with 'market supply cap reached'", async () => {
      const vUsdtSigner = await initMainnetUser(vUSDT_CORE, parseUnits("1", 18));
      const user = await initMainnetUser("0x0000000000000000000000000000000000000102", parseUnits("1", 18));
      const usdt = new ethers.Contract(USDT, ERC20_ABI, provider);
      const vUsdt = new ethers.Contract(vUSDT_CORE, VBEP20_ABI, user);

      await usdt.connect(vUsdtSigner).transfer(user.address, MINT_AMOUNT);
      await usdt.connect(user).approve(vUSDT_CORE, MINT_AMOUNT);

      await expect(vUsdt.mint(MINT_AMOUNT)).to.be.revertedWith("market supply cap reached");
    });
  });
});
