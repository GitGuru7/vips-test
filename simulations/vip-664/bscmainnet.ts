import { TransactionResponse } from "@ethersproject/providers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import { SUPPLY_CAP, vUSDT, vip664 } from "../../vips/vip-664/bscmainnet";
import CORE_COMPTROLLER_ABI from "./abi/coreComptroller.json";

const { bscmainnet } = NETWORK_ADDRESSES;

const USDT = "0x55d398326f99059ff775485246999027b3197955";
// Binance hot wallet — holds ~424 M USDT at the fork block, well above the ~206 M needed to breach the cap.
const USDT_WHALE = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";

const OLD_SUPPLY_CAP = parseUnits("600000000", 18);

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
const VTOKEN_ABI = [
  "function getCash() view returns (uint256)",
  "function totalBorrows() view returns (uint256)",
  "function totalReserves() view returns (uint256)",
  "function mint(uint256 mintAmount) returns (uint256)",
];

forking(104900000, async () => {
  const provider = ethers.provider;
  let coreComptroller: Contract;
  let vUSDTContract: Contract;
  let usdt: Contract;

  before(async () => {
    coreComptroller = new ethers.Contract(bscmainnet.UNITROLLER, CORE_COMPTROLLER_ABI, provider);
    vUSDTContract = new ethers.Contract(vUSDT, VTOKEN_ABI, provider);
    usdt = new ethers.Contract(USDT, ERC20_ABI, provider);
  });

  describe("Pre-VIP behaviour", async () => {
    it("check vUSDT supply cap", async () => {
      const supplyCap = await coreComptroller.supplyCaps(vUSDT);
      expect(supplyCap).equals(OLD_SUPPLY_CAP);
    });
  });

  testVip("VIP-664", await vip664(), {
    callbackAfterExecution: async (txResponse: TransactionResponse) => {
      await expectEvents(txResponse, [CORE_COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
    },
  });

  describe("Post-VIP behavior", async () => {
    it("check vUSDT supply cap", async () => {
      const supplyCap = await coreComptroller.supplyCaps(vUSDT);
      expect(supplyCap).equals(SUPPLY_CAP);
    });
  });

  describe("Post-VIP behavioral proof: new supply cap enforced", async () => {
    it("minting an amount that would push total supply past 390 M reverts", async () => {
      const whale = await initMainnetUser(USDT_WHALE, parseUnits("1"));

      // Compute how much underlying is currently supplied so we know the
      // exact amount needed to breach the 390 M cap.
      const cash: BigNumber = await vUSDTContract.getCash();
      const borrows: BigNumber = await vUSDTContract.totalBorrows();
      const reserves: BigNumber = await vUSDTContract.totalReserves();
      const totalUnderlying: BigNumber = cash.add(borrows).sub(reserves);
      const mintAmount: BigNumber = SUPPLY_CAP.sub(totalUnderlying).add(1);

      await usdt.connect(whale).approve(vUSDT, mintAmount);
      await expect(vUSDTContract.connect(whale).mint(mintAmount)).to.be.revertedWith("market supply cap reached");
    });
  });
});
