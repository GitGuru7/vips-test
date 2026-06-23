import { TransactionResponse } from "@ethersproject/providers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser, setMaxStalePeriod } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip664, { CURRENT_BORROW_CAP, NEW_BORROW_CAP, VUSDT } from "../../vips/vip-664/bsctestnet";
import { abi as DIAMOND_CONSOLIDATED_ABI } from "./abi/DiamondConsolidated.json";
import ERC20_ABI from "./abi/ERC20.json";
import RESILIENT_ORACLE_ABI from "./abi/ResilientOracle.json";
import VTOKEN_ABI from "./abi/VToken.json";

const { bsctestnet } = NETWORK_ADDRESSES;

// USDT is the underlying of vUSDT (6 decimals); VTreasury holds a large USDT balance on testnet.
const USDT = "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c";

// The supply cap of vUSDT is type(uint256).max on-chain (effectively unlimited, not enforced).
const SUPPLY_CAP_UNLIMITED = ethers.constants.MaxUint256;

const FORK_BLOCK = 104700000;

forking(FORK_BLOCK, async () => {
  let comptroller: Contract;
  let usdt: Contract;
  let vUsdt: Contract;
  let resilientOracle: Contract;

  before(async () => {
    comptroller = new ethers.Contract(bsctestnet.UNITROLLER, DIAMOND_CONSOLIDATED_ABI, ethers.provider);
    usdt = new ethers.Contract(USDT, ERC20_ABI, ethers.provider);
    vUsdt = new ethers.Contract(VUSDT, VTOKEN_ABI, ethers.provider);
    resilientOracle = new ethers.Contract(bsctestnet.RESILIENT_ORACLE, RESILIENT_ORACLE_ABI, ethers.provider);
  });

  describe("Pre-VIP state", () => {
    it("vUSDT borrow cap is 52,319,502.193790 USDT", async () => {
      expect(await comptroller.borrowCaps(VUSDT)).to.equal(CURRENT_BORROW_CAP);
    });

    it("vUSDT supply cap is type(uint256).max (unlimited)", async () => {
      expect(await comptroller.supplyCaps(VUSDT)).to.equal(SUPPLY_CAP_UNLIMITED);
    });
  });

  testVip("VIP-664 [BNB Chain Testnet] Raise vUSDT (Core Pool) Borrow Cap by 25%", await vip664(), {
    callbackAfterExecution: async (txResponse: TransactionResponse) => {
      await expectEvents(txResponse, [DIAMOND_CONSOLIDATED_ABI], ["NewBorrowCap"], [1]);
    },
  });

  describe("Post-VIP state", () => {
    it("vUSDT borrow cap raised to 65,399,377.742237 USDT (+25%)", async () => {
      expect(await comptroller.borrowCaps(VUSDT)).to.equal(NEW_BORROW_CAP);
    });

    it("vUSDT supply cap unchanged (still type(uint256).max)", async () => {
      expect(await comptroller.supplyCaps(VUSDT)).to.equal(SUPPLY_CAP_UNLIMITED);
    });
  });

  describe("Post-VIP behavioral: user can supply vUSDT (supply cap is unlimited)", () => {
    // 1,000,000 USDT — well above any prior practical supply and far within VTreasury's balance,
    // demonstrating that supplying is not bounded by a supply cap.
    const mintAmount = BigNumber.from("1000000").mul(BigNumber.from("10").pow(6));
    let supplier: Awaited<ReturnType<typeof initMainnetUser>>;

    before(async () => {
      // Forks advance block.timestamp, so refresh the oracle stale window before any priced action.
      await setMaxStalePeriod(resilientOracle, usdt);
      // VTreasury holds a large USDT balance on bsctestnet — impersonate it as the supplier.
      supplier = await initMainnetUser(bsctestnet.VTREASURY, ethers.utils.parseEther("1"));
      await usdt.connect(supplier).approve(VUSDT, mintAmount);
    });

    it("a user can mint vUSDT supplying 1,000,000 USDT", async () => {
      const underlyingBefore = await usdt.balanceOf(bsctestnet.VTREASURY);
      const vTokenBefore = await vUsdt.balanceOf(bsctestnet.VTREASURY);

      await expect(vUsdt.connect(supplier).mint(mintAmount)).to.not.be.reverted;

      const underlyingAfter = await usdt.balanceOf(bsctestnet.VTREASURY);
      const vTokenAfter = await vUsdt.balanceOf(bsctestnet.VTREASURY);

      // Underlying decreased by exactly the supplied amount and vTokens were received.
      expect(underlyingBefore.sub(underlyingAfter)).to.equal(mintAmount);
      expect(vTokenAfter).to.be.gt(vTokenBefore);
    });
  });
});
