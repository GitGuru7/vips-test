import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser, setMaxStalePeriodForAllAssets } from "src/utils";
import { forking, testVip } from "src/vip-framework";
import { checkRiskParameters } from "src/vip-framework/checks/checkRiskParameters";
import { checkVToken } from "src/vip-framework/checks/checkVToken";
import { checkInterestRate } from "src/vip-framework/checks/interestRateModel";

import vip664, {
  PROTOCOL_SHARE_RESERVE,
  RATE_MODEL,
  REDUCE_RESERVES_BLOCK_DELTA,
  UXRP,
  UXRP_PRICE,
  convertAmountToVTokens,
  marketSpecs,
  vTokensRemaining,
  vUXRP,
} from "../../vips/vip-664/bsctestnet";
import COMPTROLLER_ABI from "./abi/Comptroller.json";
import ERC20_ABI from "./abi/ERC20.json";
import RESILIENT_ORACLE_ABI from "./abi/ResilientOracle.json";
import VTOKEN_ABI from "./abi/VToken.json";

const { bsctestnet } = NETWORK_ADDRESSES;

// Liquid Core-pool asset borrowed against UXRP collateral in the behavioral proof.
const USDT = "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c";
const vUSDT = "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A";

// Impersonated actors for the behavioral tests.
const USER_1 = "0x1111111111111111111111111111111111111111";
const USER_2 = "0x2222222222222222222222222222222222222222";

forking(117902300, async () => {
  let comptroller: Contract;
  let resilientOracle: Contract;
  let uxrp: Contract;
  let usdt: Contract;
  let vUxrp: Contract;
  let vUsdt: Contract;

  before(async () => {
    comptroller = new ethers.Contract(marketSpecs.vToken.comptroller, COMPTROLLER_ABI, ethers.provider);
    resilientOracle = new ethers.Contract(bsctestnet.RESILIENT_ORACLE, RESILIENT_ORACLE_ABI, ethers.provider);
    uxrp = new ethers.Contract(UXRP, ERC20_ABI, ethers.provider);
    usdt = new ethers.Contract(USDT, ERC20_ABI, ethers.provider);
    vUxrp = new ethers.Contract(vUXRP, VTOKEN_ABI, ethers.provider);
    vUsdt = new ethers.Contract(vUSDT, VTOKEN_ABI, ethers.provider);
  });

  describe("Pre-VIP behavior", () => {
    it("UXRP market is not listed", async () => {
      const market = await comptroller.markets(vUXRP);
      expect(market.isListed).to.equal(false);
    });
  });

  testVip("VIP-664 List UXRP in Core Pool", await vip664(), {
    callbackAfterExecution: async txResponse => {
      await expectEvents(
        txResponse,
        [COMPTROLLER_ABI, VTOKEN_ABI],
        [
          "MarketListed",
          "NewSupplyCap",
          "NewBorrowCap",
          "NewAccessControlManager",
          "NewProtocolShareReserve",
          "NewReduceReservesBlockDelta",
          "NewReserveFactor",
          "NewCollateralFactor",
          "NewLiquidationThreshold",
          "NewLiquidationIncentive",
          "BorrowAllowedUpdated",
        ],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      );
    },
  });

  describe("Post-VIP state", () => {
    checkVToken(vUXRP, {
      name: "Venus UXRP",
      symbol: "vUXRP",
      decimals: 8,
      underlying: UXRP,
      exchangeRate: marketSpecs.vToken.exchangeRate,
      comptroller: marketSpecs.vToken.comptroller,
    });

    checkInterestRate(RATE_MODEL, "vUXRP", {
      base: marketSpecs.interestRateModel.base,
      multiplier: marketSpecs.interestRateModel.multiplier,
      jump: marketSpecs.interestRateModel.jump,
      kink: marketSpecs.interestRateModel.kink,
    });

    checkRiskParameters(vUXRP, marketSpecs.vToken, marketSpecs.riskParameters);

    it("uses the expected interest rate model", async () => {
      expect(await vUxrp.interestRateModel()).to.equal(RATE_MODEL);
    });

    it("has the correct admin (Normal Timelock)", async () => {
      expect(await vUxrp.admin()).to.equal(bsctestnet.NORMAL_TIMELOCK);
    });

    it("has the correct ACM", async () => {
      expect(await vUxrp.accessControlManager()).to.equal(bsctestnet.ACCESS_CONTROL_MANAGER);
    });

    it("has the correct protocol share reserve", async () => {
      expect(await vUxrp.protocolShareReserve()).to.equal(PROTOCOL_SHARE_RESERVE);
    });

    it("has the correct reduce-reserves block delta", async () => {
      expect(await vUxrp.reduceReservesBlockDelta()).to.equal(REDUCE_RESERVES_BLOCK_DELTA);
    });

    it("sets collateral factor and liquidation threshold", async () => {
      const market = await comptroller.markets(vUXRP);
      expect(market.collateralFactorMantissa).to.equal(marketSpecs.riskParameters.collateralFactor);
      expect(market.liquidationThresholdMantissa).to.equal(marketSpecs.riskParameters.liquidationThreshold);
      expect(market.liquidationIncentiveMantissa).to.equal(marketSpecs.riskParameters.liquidationIncentive);
    });

    it("enables borrowing on the market", async () => {
      const market = await comptroller.markets(vUXRP);
      expect(market.isBorrowAllowed).to.equal(true);
    });

    it("returns the seeded oracle price ($2.50)", async () => {
      expect(await resilientOracle.getUnderlyingPrice(vUXRP)).to.equal(UXRP_PRICE);
    });

    it("bootstrapped the market supply", async () => {
      expect(await uxrp.balanceOf(vUXRP)).to.equal(marketSpecs.initialSupply.amount);
      expect(await vUxrp.totalSupply()).to.equal(
        convertAmountToVTokens(marketSpecs.initialSupply.amount, marketSpecs.vToken.exchangeRate),
      );
    });

    it("burned part of the bootstrap vTokens and sent the rest to the Treasury", async () => {
      expect(await vUxrp.balanceOf(ethers.constants.AddressZero)).to.equal(marketSpecs.initialSupply.vTokensToBurn);
      expect(await vUxrp.balanceOf(bsctestnet.VTREASURY)).to.equal(vTokensRemaining);
      expect(await vUxrp.balanceOf(bsctestnet.NORMAL_TIMELOCK)).to.equal(0);
    });
  });

  describe("Post-VIP behavior (functional proof)", () => {
    let user1: any;
    let user2: any;

    before(async () => {
      // Forks advance time, so bump the borrow asset's Chainlink stale period; UXRP uses a
      // direct price and never goes stale.
      await setMaxStalePeriodForAllAssets(resilientOracle, [usdt]);

      user1 = await initMainnetUser(USER_1, parseUnits("10"));
      user2 = await initMainnetUser(USER_2, parseUnits("10"));
    });

    it("lets a user supply UXRP as collateral and borrow a liquid asset against it", async () => {
      const collateral = parseUnits("100", 18);
      await uxrp.connect(user1).faucet(parseUnits("200", 18));
      await uxrp.connect(user1).approve(vUXRP, collateral);
      await vUxrp.connect(user1).mint(collateral);
      await comptroller.connect(user1).enterMarkets([vUXRP]);

      const borrowAmount = parseUnits("100", 6); // USDT has 6 decimals
      const before = await usdt.balanceOf(USER_1);
      await expect(vUsdt.connect(user1).borrow(borrowAmount)).to.not.be.reverted;
      expect(await usdt.balanceOf(USER_1)).to.equal(before.add(borrowAmount));
      expect(await vUsdt.borrowBalanceStored(USER_1)).to.be.gte(borrowAmount);
    });

    it("enforces the supply cap (236 UXRP)", async () => {
      // Current supply is ~100.26 UXRP; minting past 236 must revert.
      await uxrp.connect(user2).faucet(parseUnits("400", 18));
      await uxrp.connect(user2).approve(vUXRP, parseUnits("400", 18));

      await expect(vUxrp.connect(user2).mint(parseUnits("200", 18))).to.be.revertedWith("market supply cap reached");

      // A mint that stays under the cap succeeds.
      const supplyBefore = await vUxrp.totalSupply();
      await expect(vUxrp.connect(user2).mint(parseUnits("130", 18))).to.not.be.reverted;
      expect(await vUxrp.totalSupply()).to.be.gt(supplyBefore);
    });

    it("enforces the collateral factor / liquidation threshold", async () => {
      const market = await comptroller.markets(vUXRP);
      expect(market.collateralFactorMantissa).to.equal(parseUnits("0.6", 18));
      expect(market.liquidationThresholdMantissa).to.equal(parseUnits("0.7", 18));
    });

    it("enforces the borrow cap (236 UXRP)", async () => {
      // A UXRP borrow within the caller's borrowing power and under the cap succeeds.
      const smallBorrow = parseUnits("10", 18);
      const before: BigNumber = await uxrp.balanceOf(USER_1);
      await expect(vUxrp.connect(user1).borrow(smallBorrow)).to.not.be.reverted;
      expect(await uxrp.balanceOf(USER_1)).to.equal(before.add(smallBorrow));

      // A borrow exceeding the 236 UXRP cap reverts on the cap check (before the liquidity check).
      await expect(vUxrp.connect(user1).borrow(parseUnits("237", 18))).to.be.revertedWith("market borrow cap reached");
    });
  });
});
