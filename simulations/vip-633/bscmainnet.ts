import { expect } from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expectEvents, initMainnetUser } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip633, { COMPTROLLER, NEW_SUPPLY_CAP, OLD_SUPPLY_CAP, vUSDT } from "../../vips/vip-633/bscmainnet";
import BSC_COMPTROLLER_ABI from "./abi/BscComptroller.json";
import VTOKEN_ABI from "./abi/VToken.json";

const FORK_BLOCK = 103745245;

// USDT underlying on BNB Chain (18 decimals) and the borrow cap this VIP must leave unchanged.
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BORROW_CAP = parseUnits("450000000", 18);

// Two Binance wallets used to source USDT for the behavioral proof (neither alone holds
// enough to push total supply past the old 600M cap, so the test draws from both).
const USDT_WHALE_1 = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";
const USDT_WHALE_2 = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
const MINTER = "0x000000000000000000000000000000000000A633";

// Target total underlying supply for the behavioral proof: comfortably inside the new
// (600M, 800M] band so it would revert under the old cap but succeed under the new one.
const TARGET_TOTAL_SUPPLY = parseUnits("700000000", 18);

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
];

forking(FORK_BLOCK, async () => {
  const comptroller = new ethers.Contract(COMPTROLLER, BSC_COMPTROLLER_ABI, ethers.provider);

  describe("Pre-VIP state (bscmainnet)", () => {
    it("vUSDT supply cap is 600M", async () => {
      expect((await comptroller.supplyCaps(vUSDT)).toString()).to.equal(OLD_SUPPLY_CAP.toString());
    });

    it("vUSDT borrow cap is 450M", async () => {
      expect((await comptroller.borrowCaps(vUSDT)).toString()).to.equal(BORROW_CAP.toString());
    });
  });

  testVip("VIP-633 Raise vUSDT Supply Cap to 800M", await vip633(), {
    callbackAfterExecution: async tx => {
      await expectEvents(tx, [BSC_COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
    },
  });

  describe("Post-VIP state (bscmainnet)", () => {
    it("vUSDT supply cap raised to 800M", async () => {
      expect((await comptroller.supplyCaps(vUSDT)).toString()).to.equal(NEW_SUPPLY_CAP.toString());
    });

    it("vUSDT borrow cap unchanged at 450M", async () => {
      expect((await comptroller.borrowCaps(vUSDT)).toString()).to.equal(BORROW_CAP.toString());
    });
  });

  describe("Behavioral proof (bscmainnet)", () => {
    it("supplies USDT past the old 600M ceiling and rejects supplying beyond the new 800M ceiling", async () => {
      const vToken = new ethers.Contract(vUSDT, VTOKEN_ABI, ethers.provider);
      const usdt = new ethers.Contract(USDT, ERC20_ABI, ethers.provider);

      // Underlying value the supply cap is checked against: vTokenSupply * exchangeRate.
      const vTokenSupply = await vToken.totalSupply();
      const exchangeRate = await vToken.exchangeRateStored();
      const currentSupply = vTokenSupply.mul(exchangeRate).div(parseUnits("1", 18));
      expect(currentSupply).to.be.lt(OLD_SUPPLY_CAP); // sanity: well below the old cap today
      expect(currentSupply).to.be.lt(TARGET_TOTAL_SUPPLY);

      // Amount that lifts total supply from ~200M to ~700M — beyond the old 600M cap.
      const mintAmount = TARGET_TOTAL_SUPPLY.sub(currentSupply);

      // Fund the minter with USDT, drawing from whale 1 first and topping up from whale 2.
      const minter = await initMainnetUser(MINTER, parseUnits("10", 18));
      const whale1 = await initMainnetUser(USDT_WHALE_1, parseUnits("10", 18));
      const whale2 = await initMainnetUser(USDT_WHALE_2, parseUnits("10", 18));

      const whale1Balance = await usdt.balanceOf(USDT_WHALE_1);
      const fromWhale1 = mintAmount.lt(whale1Balance) ? mintAmount : whale1Balance;
      await usdt.connect(whale1).transfer(MINTER, fromWhale1);
      if (mintAmount.gt(fromWhale1)) {
        await usdt.connect(whale2).transfer(MINTER, mintAmount.sub(fromWhale1));
      }
      expect(await usdt.balanceOf(MINTER)).to.be.gte(mintAmount);

      // Supplying past the old 600M cap succeeds under the new 800M cap.
      await usdt.connect(minter).approve(vUSDT, ethers.constants.MaxUint256);
      const vTokenBefore = await vToken.balanceOf(MINTER);
      await expect(vToken.connect(minter).mint(mintAmount)).to.not.be.reverted;
      expect(await vToken.balanceOf(MINTER)).to.be.gt(vTokenBefore);

      // Total supply now sits above the old 600M cap — this mint could not have happened before the VIP.
      const supplyAfter = (await vToken.totalSupply()).mul(await vToken.exchangeRateStored()).div(parseUnits("1", 18));
      expect(supplyAfter).to.be.gt(OLD_SUPPLY_CAP);
      expect(supplyAfter).to.be.lte(NEW_SUPPLY_CAP);

      // A further supply that would push total supply beyond the new 800M cap is rejected.
      const overCapAmount = NEW_SUPPLY_CAP.sub(supplyAfter).add(parseUnits("50000000", 18)); // ~150M, crosses 800M
      await expect(vToken.connect(minter).mint(overCapAmount)).to.be.revertedWith("market supply cap reached");
    });
  });
});
