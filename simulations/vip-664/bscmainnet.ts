import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import {
  expectEvents,
  initMainnetUser,
  pinResilientOraclePriceViaRedstone,
  setMaxStalePeriodForAllAssets,
  setMaxStalePeriodInBinanceOracle,
  setMaxStalePeriodInChainlinkOracle,
} from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip664, {
  ASSETS,
  BINANCE_ORACLE,
  BOUND_VALIDATOR,
  LOWER_BOUND,
  RESILIENT_ORACLE,
  UPPER_BOUND,
} from "../../vips/vip-664/bscmainnet";
import BINANCE_ORACLE_ABI from "./abi/binanceOracle.json";
import BOUND_VALIDATOR_ABI from "./abi/boundValidator.json";
import CHAINLINK_ORACLE_ABI from "./abi/chainlinkOracle.json";
import ERC20_ABI from "./abi/erc20.json";
import RESILIENT_ORACLE_ABI from "./abi/resilientOracle.json";

const { bscmainnet } = NETWORK_ADDRESSES;

const BLOCK_NUMBER = 103745245;
const STALE_PERIOD_OVERRIDE = 315360000; // 10 years
const PRICE_TOLERANCE_BPS = 500; // 5%

// Previous Binance Oracle deployment, superseded by BINANCE_ORACLE (the new one set as PIVOT here).
const OLD_BINANCE_ORACLE = "0x9e6928ec418948ceb9f1cd9872fd312b13d841d0";

// Pre-VIP oracle landscape at BLOCK_NUMBER, read on-chain (ResilientOracle.getTokenConfig):
//   - PIVOT is the OLD Binance Oracle for: AAVE, BCH, DOGE, DOT, FDUSD, FIL, LINK, LTC, SOL, TUSD, UNI, WBETH, THE
//   - PIVOT is RedStone for: ADA, CAKE, DAI, XRP, XVS
//   - PIVOT is already the NEW Binance Oracle for: asBNB, VAI
//   - PIVOT is the SolvBTC-specific oracle for: SolvBTC
// 16 of the 21 markets currently run an ENABLED FALLBACK (RedStone or the old Binance Oracle); this VIP
// clears every FALLBACK to address(0). The 5 below already have no enabled FALLBACK pre-VIP.
const PREVIP_FALLBACK_DISABLED = ["TUSD", "WBETH", "THE", "asBNB", "VAI"];
// asBNB and VAI already have the NEW Binance Oracle as PIVOT; for everyone else the VIP introduces it.
const PREVIP_BINANCE_PIVOT = ["asBNB", "VAI"];

// Base tokens read by the custom MAIN oracles (asBNB -> slisBNB, WBETH -> ETH, SolvBTC -> BTCB).
// Their ResilientOracle feeds must also be made non-stale for the custom oracles to resolve on a fork.
const SLISBNB = "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B";
const ETH = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";

// SolvBTC's MAIN OneJump oracle prices SolvBTC through the Chainlink oracle directly (its intermediate
// oracle), which is not part of SolvBTC's ResilientOracle config, so freshen it explicitly.
const SOLVBTC = "0x4aae823a6a0b376De6A78e74eCC5b079d38cBCf7";
// THE's MAIN is RedStone, whose feed enforces its own stale window below the Venus oracle layer; on a
// time-warped fork a direct price is required (bumping maxStalePeriod is a no-op for it).
const THE = "0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11";

forking(BLOCK_NUMBER, async () => {
  let resilientOracle: Contract;
  let binanceOracle: Contract;
  let boundValidator: Contract;
  const preVipPrice: Record<string, BigNumber> = {};

  before(async () => {
    resilientOracle = await ethers.getContractAt(RESILIENT_ORACLE_ABI, RESILIENT_ORACLE);
    binanceOracle = await ethers.getContractAt(BINANCE_ORACLE_ABI, BINANCE_ORACLE);
    boundValidator = await ethers.getContractAt(BOUND_VALIDATOR_ABI, BOUND_VALIDATOR);
    for (const asset of ASSETS) {
      preVipPrice[asset.asset] = await resilientOracle.getPrice(asset.asset);
    }

    // The custom MAIN oracles for asBNB / WBETH / SolvBTC price their underlying via the ResilientOracle
    // for slisBNB / ETH / BTCB, whose feeds have internal stale guards that survive a fork time warp.
    // Pin those base prices now (fresh, pre-warp); the pin persists through testVip since the VIP does
    // not touch these assets. The markets under test keep their real Binance PIVOT config.
    for (const base of [SLISBNB, ETH, BTCB]) {
      await pinResilientOraclePriceViaRedstone(resilientOracle, base);
    }
  });

  // =====================================================================================
  // PRE-VIP — Binance is not the PIVOT for the markets being migrated (asBNB/VAI already have it)
  // =====================================================================================
  describe("Pre-VIP state", () => {
    for (const asset of ASSETS) {
      const alreadyBinancePivot = PREVIP_BINANCE_PIVOT.includes(asset.symbol);
      const fallbackEnabledPreVip = !PREVIP_FALLBACK_DISABLED.includes(asset.symbol);

      it(`${asset.symbol}: MAIN oracle is the expected on-chain oracle`, async () => {
        const config = await resilientOracle.getTokenConfig(asset.asset);
        expect(config.oracles[0].toLowerCase()).to.equal(asset.mainOracle.toLowerCase());
      });

      it(`${asset.symbol}: PIVOT slot ${alreadyBinancePivot ? "is" : "is not"} the (new) Binance Oracle`, async () => {
        const config = await resilientOracle.getTokenConfig(asset.asset);
        if (alreadyBinancePivot) {
          expect(config.oracles[1].toLowerCase()).to.equal(BINANCE_ORACLE.toLowerCase());
        } else {
          expect(config.oracles[1].toLowerCase()).to.not.equal(BINANCE_ORACLE.toLowerCase());
        }
      });

      // Snapshot the FALLBACK slot the VIP is about to clear, so the migration scope is tested end-to-end.
      it(`${asset.symbol}: FALLBACK is ${
        fallbackEnabledPreVip ? "currently enabled (cleared by this VIP)" : "already empty"
      }`, async () => {
        const config = await resilientOracle.getTokenConfig(asset.asset);
        if (fallbackEnabledPreVip) {
          expect(config.enableFlagsForOracles[2]).to.equal(true);
          expect(config.oracles[2]).to.not.equal(ethers.constants.AddressZero);
        } else {
          expect(config.oracles[2]).to.equal(ethers.constants.AddressZero);
        }
      });
    }

    it("Binance symbol override Cake -> CAKE is already configured", async () => {
      expect(await binanceOracle.symbols("Cake")).to.equal("CAKE");
    });

    it("the Binance Oracle set as PIVOT is the new deployment, not the superseded one", async () => {
      expect(BINANCE_ORACLE.toLowerCase()).to.not.equal(OLD_BINANCE_ORACLE.toLowerCase());
    });
  });

  // =====================================================================================
  // EXECUTION — queue, vote, and execute; assert the emitted events
  // =====================================================================================
  testVip("VIP-664 Add Binance Oracle as PIVOT for 21 Core Pool markets", await vip664(), {
    callbackAfterExecution: async txResponse => {
      // One TokenConfigAdded per market on the ResilientOracle.
      await expectEvents(txResponse, [RESILIENT_ORACLE_ABI], ["TokenConfigAdded"], [ASSETS.length]);
      // One MaxStalePeriodAdded per symbol on the Binance Oracle.
      await expectEvents(txResponse, [BINANCE_ORACLE_ABI], ["MaxStalePeriodAdded"], [ASSETS.length]);
      // One ValidateConfigAdded per market on the BoundValidator.
      await expectEvents(txResponse, [BOUND_VALIDATOR_ABI], ["ValidateConfigAdded"], [ASSETS.length]);
    },
  });

  // =====================================================================================
  // POST-VIP — assert the new configuration
  // =====================================================================================
  describe("Post-VIP config", () => {
    for (const asset of ASSETS) {
      it(`${asset.symbol}: ResilientOracle config = [MAIN unchanged, Binance PIVOT, empty FALLBACK]`, async () => {
        const config = await resilientOracle.getTokenConfig(asset.asset);
        expect(config.oracles.map((oracle: string) => oracle.toLowerCase())).to.deep.equal([
          asset.mainOracle.toLowerCase(),
          BINANCE_ORACLE.toLowerCase(),
          ethers.constants.AddressZero,
        ]);
        expect(config.enableFlagsForOracles).to.deep.equal([true, true, false]);
      });

      it(`${asset.symbol}: Binance maxStalePeriod = ${asset.maxStalePeriod}s`, async () => {
        expect(await binanceOracle.maxStalePeriod(asset.binanceSymbol)).to.equal(asset.maxStalePeriod);
      });

      it(`${asset.symbol}: BoundValidator config = 0.95 / 1.05`, async () => {
        const config = await boundValidator.validateConfigs(asset.asset);
        expect(config.upperBoundRatio).to.equal(UPPER_BOUND);
        expect(config.lowerBoundRatio).to.equal(LOWER_BOUND);
      });
    }

    it("Binance symbol override Cake -> CAKE remains configured", async () => {
      expect(await binanceOracle.symbols("Cake")).to.equal("CAKE");
    });
  });

  // =====================================================================================
  // POST-VIP behavioral proof — every market still prices (MAIN validated against Binance PIVOT)
  // =====================================================================================
  describe("Post-VIP prices", () => {
    before(async () => {
      const freshenAddresses = [...ASSETS.map(a => a.asset), SLISBNB, ETH, BTCB];
      const freshenContracts = await Promise.all(
        freshenAddresses.map(address => ethers.getContractAt(ERC20_ABI, address)),
      );
      // Bumps each asset's MAIN (Chainlink/RedStone) and now-enabled Binance PIVOT stale periods.
      await setMaxStalePeriodForAllAssets(resilientOracle, freshenContracts);

      // Belt-and-suspenders: ensure every Binance feed used by a PIVOT is non-stale (override-aware).
      for (const asset of ASSETS) {
        await setMaxStalePeriodInBinanceOracle(BINANCE_ORACLE, asset.binanceSymbol, STALE_PERIOD_OVERRIDE);
      }

      // SolvBTC's MAIN OneJump prices SolvBTC through the Chainlink oracle directly — freshen that feed.
      await setMaxStalePeriodInChainlinkOracle(
        bscmainnet.CHAINLINK_ORACLE,
        SOLVBTC,
        ethers.constants.AddressZero,
        bscmainnet.NORMAL_TIMELOCK,
        STALE_PERIOD_OVERRIDE,
      );

      // THE's MAIN RedStone feed cannot be de-staled via maxStalePeriod; pin its direct price (the MAIN
      // slot, leaving the Binance PIVOT in place) to the captured pre-VIP value so the pivot validation
      // still exercises the real Binance price.
      const timelock = await initMainnetUser(bscmainnet.NORMAL_TIMELOCK, ethers.utils.parseEther("1"));
      const redstoneOracle = new ethers.Contract(bscmainnet.REDSTONE_ORACLE, CHAINLINK_ORACLE_ABI, timelock);
      await redstoneOracle.setDirectPrice(THE, preVipPrice[THE]);
    });

    for (const asset of ASSETS) {
      it(`${asset.symbol}: price resolves and stays within tolerance of the pre-VIP price`, async () => {
        const price = await resilientOracle.getPrice(asset.asset);
        expect(price).to.be.gt(0);
        const before = preVipPrice[asset.asset];
        expect(price.sub(before).abs().mul(10000)).to.be.lte(before.mul(PRICE_TOLERANCE_BPS));
      });
    }
  });
});
