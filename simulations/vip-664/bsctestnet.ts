import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser } from "src/utils";
import { forking, testVip } from "src/vip-framework";
import { checkRiskParameters } from "src/vip-framework/checks/checkRiskParameters";
import { checkVToken } from "src/vip-framework/checks/checkVToken";
import { checkInterestRate } from "src/vip-framework/checks/interestRateModel";

import {
  PROTOCOL_SHARE_RESERVE,
  RATE_MODEL,
  REDUCE_RESERVES_BLOCK_DELTA,
  convertAmountToVTokens,
  marketSpecs,
  vTokensRemaining,
  vip664,
} from "../../vips/vip-664/bsctestnet";
import COMPTROLLER_ABI from "./abi/Comptroller.json";
import ERC20_ABI from "./abi/ERC20.json";
import RESILIENT_ORACLE_ABI from "./abi/ResilientOracle.json";
import VTOKEN_ABI from "./abi/VToken.json";
import VTREASURY_ABI from "./abi/VTreasury.json";

const { bsctestnet } = NETWORK_ADDRESSES;

// getUnderlyingPrice is scaled to (36 - underlyingDecimals) decimals. FLOKI has 9 decimals,
// so a direct price of 0.00015 USD (set in 18 decimals) is returned as 0.00015 * 1e27.
const EXPECTED_UNDERLYING_PRICE = parseUnits("0.00015", 27);

forking(119626000, async () => {
  let comptroller: Contract;
  let resilientOracle: Contract;
  let mockFLOKI: Contract;
  let vFLOKI: Contract;

  before(async () => {
    const provider = ethers.provider;
    comptroller = new ethers.Contract(marketSpecs.vToken.comptroller, COMPTROLLER_ABI, provider);
    mockFLOKI = new ethers.Contract(marketSpecs.vToken.underlying.address, ERC20_ABI, provider);
    vFLOKI = new ethers.Contract(marketSpecs.vToken.address, VTOKEN_ABI, provider);
    resilientOracle = new ethers.Contract(bsctestnet.RESILIENT_ORACLE, RESILIENT_ORACLE_ABI, provider);
  });

  describe("Pre-VIP behavior", async () => {
    it("check FLOKI market not listed", async () => {
      const market = await comptroller.markets(marketSpecs.vToken.address);
      expect(market.isListed).to.equal(false);
    });
  });

  testVip("VIP-664 Add FLOKI market to Core pool", await vip664(), {
    callbackAfterExecution: async txResponse => {
      await expectEvents(
        txResponse,
        [COMPTROLLER_ABI, VTOKEN_ABI, VTREASURY_ABI],
        [
          "MarketListed",
          "NewSupplyCap",
          "ActionPausedMarket",
          "NewAccessControlManager",
          "NewProtocolShareReserve",
          "NewReduceReservesBlockDelta",
          "NewReserveFactor",
          "NewCollateralFactor",
          "NewLiquidationThreshold",
          "NewLiquidationIncentive",
        ],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      );
    },
  });

  describe("Post-VIP behavior", async () => {
    it("check new IRM", async () => {
      expect(await vFLOKI.interestRateModel()).to.equal(RATE_MODEL);
    });

    checkInterestRate(RATE_MODEL, "vFLOKI", {
      base: marketSpecs.interestRateModel.baseRatePerYear,
      multiplier: marketSpecs.interestRateModel.multiplierPerYear,
      jump: marketSpecs.interestRateModel.jumpMultiplierPerYear,
      kink: marketSpecs.interestRateModel.kink,
    });

    checkVToken(marketSpecs.vToken.address, {
      name: "Venus FLOKI",
      symbol: "vFLOKI",
      decimals: 8,
      underlying: marketSpecs.vToken.underlying.address,
      exchangeRate: marketSpecs.vToken.exchangeRate,
      comptroller: marketSpecs.vToken.comptroller,
    });

    checkRiskParameters(marketSpecs.vToken.address, marketSpecs.vToken, marketSpecs.riskParameters);

    it("get correct price from oracle", async () => {
      const price = await resilientOracle.getUnderlyingPrice(marketSpecs.vToken.address);
      expect(price).to.equal(EXPECTED_UNDERLYING_PRICE);
    });

    it("market have correct owner", async () => {
      expect(await vFLOKI.admin()).to.equal(bsctestnet.NORMAL_TIMELOCK);
    });

    it("market have correct ACM", async () => {
      expect(await vFLOKI.accessControlManager()).to.equal(bsctestnet.ACCESS_CONTROL_MANAGER);
    });

    it("market should have correct protocol share reserve", async () => {
      expect(await vFLOKI.protocolShareReserve()).to.equal(PROTOCOL_SHARE_RESERVE);
    });

    it("market should have correct reduce reserves block delta", async () => {
      expect(await vFLOKI.reduceReservesBlockDelta()).to.equal(REDUCE_RESERVES_BLOCK_DELTA);
    });

    it("market should have correct total supply", async () => {
      const totalSupply = await vFLOKI.totalSupply();
      expect(totalSupply).to.equal(
        convertAmountToVTokens(marketSpecs.initialSupply.amount, marketSpecs.vToken.exchangeRate),
      );
    });

    it("market should have balance of underlying", async () => {
      const balance = await mockFLOKI.balanceOf(vFLOKI.address);
      expect(balance).to.equal(marketSpecs.initialSupply.amount);
    });

    it("should burn vTokens to the zero address", async () => {
      const burned = await vFLOKI.balanceOf(ethers.constants.AddressZero);
      expect(burned).to.equal(marketSpecs.initialSupply.vTokensToBurn);
    });

    it("should send remaining vTokens to vTokenReceiver", async () => {
      const receiverBalance = await vFLOKI.balanceOf(marketSpecs.initialSupply.vTokenReceiver);
      expect(receiverBalance).to.equal(vTokensRemaining);
    });

    it("should not leave any vTokens in the timelock", async () => {
      const timelockBalance = await vFLOKI.balanceOf(bsctestnet.NORMAL_TIMELOCK);
      expect(timelockBalance).to.equal(0);
    });

    it("should pause Borrow on vFLOKI market", async () => {
      expect(await comptroller.actionPaused(marketSpecs.vToken.address, 2)).to.equal(true);
    });
  });

  describe("Post-VIP behavioral proof (paused borrow launch)", async () => {
    const supplier = "0xe70898180a366F204AA529708fB8f5052ea5723c";
    let user: Signer;
    let vFLOKIUser: Contract;
    let flokiUser: Contract;

    before(async () => {
      user = await initMainnetUser(supplier, parseUnits("10", 18));
      vFLOKIUser = new ethers.Contract(marketSpecs.vToken.address, VTOKEN_ABI, user);
      flokiUser = new ethers.Contract(marketSpecs.vToken.underlying.address, ERC20_ABI, user);
    });

    it("supplying (mint) within the supply cap succeeds", async () => {
      const supplyAmount = parseUnits("1000000", 9); // 1,000,000 FLOKI, well under the 40B cap
      await flokiUser.faucet(supplyAmount);
      await flokiUser.approve(marketSpecs.vToken.address, supplyAmount);
      await expect(vFLOKIUser.mint(supplyAmount)).to.emit(vFLOKIUser, "Mint");
      expect(await vFLOKIUser.balanceOf(supplier)).to.be.gt(0);
    });

    it("borrowing reverts because the borrow action is paused", async () => {
      await expect(vFLOKIUser.borrow(parseUnits("1", 9))).to.be.reverted;
    });

    it("minting beyond the supply cap reverts", async () => {
      const overCap = marketSpecs.riskParameters.supplyCap; // minting the full cap again pushes total over cap
      await flokiUser.faucet(overCap);
      await flokiUser.approve(marketSpecs.vToken.address, overCap);
      await expect(vFLOKIUser.mint(overCap)).to.be.reverted;
    });
  });
});
