import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expectEvents, initMainnetUser } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip664, { COMPTROLLER_CORE, NEW_USDT_SUPPLY_CAP, vUSDT } from "../../vips/vip-664/bscmainnet";
import COMPTROLLER_ABI from "./abi/Comptroller.json";
import ERC20_ABI from "./abi/ERC20.json";
import VTOKEN_ABI from "./abi/VToken.json";

const FORK_BLOCK = 106252730;

const OLD_USDT_SUPPLY_CAP = parseUnits("600000000", 18);
const USDT = "0x55d398326f99059fF775485246999027B3197955";
// Binance hot wallet — holds ~200M USDT at the fork block, enough to push the market past the new cap.
const USDT_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

forking(FORK_BLOCK, async () => {
  const comptroller = new ethers.Contract(COMPTROLLER_CORE, COMPTROLLER_ABI, ethers.provider);
  const vUsdt = new ethers.Contract(vUSDT, VTOKEN_ABI, ethers.provider);
  const usdt = new ethers.Contract(USDT, ERC20_ABI, ethers.provider);

  describe("Pre-VIP state (bscmainnet)", () => {
    it("vUSDT supply cap is 600M", async () => {
      expect(await comptroller.supplyCaps(vUSDT)).to.equal(OLD_USDT_SUPPLY_CAP);
    });
  });

  testVip("VIP-664 Set vUSDT Supply Cap to 390M", await vip664(), {
    callbackAfterExecution: async tx => {
      await expectEvents(tx, [COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
    },
  });

  describe("Post-VIP state (bscmainnet)", () => {
    it("vUSDT supply cap is 390M", async () => {
      expect(await comptroller.supplyCaps(vUSDT)).to.equal(NEW_USDT_SUPPLY_CAP);
    });
  });

  describe("Post-VIP behavior (bscmainnet)", () => {
    it("current underlying supply is below the new 390M cap", async () => {
      const exchangeRate: BigNumber = await vUsdt.exchangeRateStored();
      const totalSupply: BigNumber = await vUsdt.totalSupply();
      const underlyingSupply = totalSupply.mul(exchangeRate).div(parseUnits("1", 18));
      expect(underlyingSupply).to.be.lt(NEW_USDT_SUPPLY_CAP);
    });

    it("allows supplying USDT while total supply stays below the new cap", async () => {
      const whale = await initMainnetUser(USDT_WHALE, parseUnits("1"));
      const mintAmount = parseUnits("100000", 18); // 100k USDT, well within remaining room
      await usdt.connect(whale).approve(vUSDT, mintAmount);

      const balanceBefore: BigNumber = await vUsdt.balanceOf(USDT_WHALE);
      await expect(vUsdt.connect(whale).mint(mintAmount)).to.not.be.reverted;
      expect(await vUsdt.balanceOf(USDT_WHALE)).to.be.gt(balanceBefore);
    });

    it("blocks a mint that would push total supply past the new 390M cap", async () => {
      const whale = await initMainnetUser(USDT_WHALE, parseUnits("1"));
      // Minting the whale's full remaining USDT balance crosses 390M (supply ~195M + ~200M > 390M).
      const overCapAmount: BigNumber = await usdt.balanceOf(USDT_WHALE);
      await usdt.connect(whale).approve(vUSDT, overCapAmount);

      await expect(vUsdt.connect(whale).mint(overCapAmount)).to.be.revertedWith("market supply cap reached");
    });
  });
});
