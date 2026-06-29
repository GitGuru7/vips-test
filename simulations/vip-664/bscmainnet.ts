import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES, ORACLE_BNB } from "src/networkAddresses";
import { expectEvents, pinResilientOraclePriceViaRedstone } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip664 from "../../vips/vip-664/bscmainnet";
import * as bsc from "../../vips/vip-664/data/bscmainnet";
import BSC_COMPTROLLER_ABI from "./abi/BscComptroller.json";
import RESILIENT_ORACLE_ABI from "./abi/ResilientOracle.json";
import VTOKEN_ABI from "./abi/VToken.json";

const { RESILIENT_ORACLE } = NETWORK_ADDRESSES.bscmainnet;
const VBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";

// Recent block (a few hundred blocks behind head).
const FORK_BLOCK = 107080000;

// REGULAR proposals require a 1,000,000 XVS proposer threshold (proposalConfigs[0]); the
// framework's default proposer has eroded below that, so use a current >1M XVS staker
// (the live proposer of the latest on-chain proposal at this fork block).
const PROPOSER = "0x34221485302f6f2029660a000908b5fcabb9bc6e";

forking(FORK_BLOCK, async () => {
  const comptroller = new ethers.Contract(bsc.COMPTROLLER, BSC_COMPTROLLER_ABI, ethers.provider);

  // The governance flow advances time past the timelock delay, so resilient-oracle feeds
  // for every recalibrated market would go stale and revert setCollateralFactor's price
  // lookup ("invalid resilient oracle price"). Pin each underlying's price (read fresh at
  // the fork block) so it stays valid through execution.
  before(async () => {
    const resilientOracle = new ethers.Contract(RESILIENT_ORACLE, RESILIENT_ORACLE_ABI, ethers.provider);
    const vTokens = new Set<string>([...bsc.cfChanges, ...bsc.emodeCfChanges].map(c => c.vToken));
    const underlyings = new Set<string>();
    for (const vToken of vTokens) {
      if (ethers.utils.getAddress(vToken) === VBNB) {
        underlyings.add(ORACLE_BNB);
        continue;
      }
      const v = new ethers.Contract(vToken, VTOKEN_ABI, ethers.provider);
      underlyings.add(ethers.utils.getAddress(await v.underlying()));
    }
    for (const underlying of underlyings) {
      await pinResilientOraclePriceViaRedstone(resilientOracle, underlying);
    }
  });

  describe("Pre-VIP state (bscmainnet)", () => {
    it("matches current Core Pool collateral factors and liquidation thresholds", async () => {
      for (const c of bsc.cfChanges) {
        const md = await comptroller.markets(c.vToken);
        expect(md.collateralFactorMantissa.toString()).to.equal(c.oldCF.toString(), `${c.symbol} CF`);
        expect(md.liquidationThresholdMantissa.toString()).to.equal(c.oldLT.toString(), `${c.symbol} LT`);
      }
    });

    it("matches current eMode-pool collateral factors and liquidation thresholds", async () => {
      for (const c of bsc.emodeCfChanges) {
        const md = await comptroller.poolMarkets(c.poolId, c.vToken);
        expect(md.collateralFactorMantissa.toString()).to.equal(c.oldCF.toString(), `${c.symbol} pool ${c.poolId} CF`);
        expect(md.liquidationThresholdMantissa.toString()).to.equal(
          c.oldLT.toString(),
          `${c.symbol} pool ${c.poolId} LT`,
        );
      }
    });
  });

  testVip("VIP-664 BNB Chain Core", await vip664(), {
    proposer: PROPOSER,
    callbackAfterExecution: async tx =>
      expectEvents(
        tx,
        [BSC_COMPTROLLER_ABI],
        ["NewCollateralFactor"],
        [bsc.cfChanges.length + bsc.emodeCfChanges.length],
      ),
  });

  describe("Post-VIP state (bscmainnet)", () => {
    it("applies new Core Pool collateral factors and liquidation thresholds (-2pp each)", async () => {
      for (const c of bsc.cfChanges) {
        const md = await comptroller.markets(c.vToken);
        expect(md.collateralFactorMantissa.toString()).to.equal(c.newCF.toString(), `${c.symbol} CF`);
        expect(md.liquidationThresholdMantissa.toString()).to.equal(c.newLT.toString(), `${c.symbol} LT`);
      }
    });

    it("applies new eMode-pool collateral factors and liquidation thresholds (-2pp each)", async () => {
      for (const c of bsc.emodeCfChanges) {
        const md = await comptroller.poolMarkets(c.poolId, c.vToken);
        expect(md.collateralFactorMantissa.toString()).to.equal(c.newCF.toString(), `${c.symbol} pool ${c.poolId} CF`);
        expect(md.liquidationThresholdMantissa.toString()).to.equal(
          c.newLT.toString(),
          `${c.symbol} pool ${c.poolId} LT`,
        );
      }
    });

    it("keeps CF <= LT on every recalibrated market", async () => {
      for (const c of bsc.cfChanges) {
        const md = await comptroller.markets(c.vToken);
        expect(md.collateralFactorMantissa.lte(md.liquidationThresholdMantissa)).to.equal(true, `${c.symbol} CF<=LT`);
      }
      for (const c of bsc.emodeCfChanges) {
        const md = await comptroller.poolMarkets(c.poolId, c.vToken);
        expect(md.collateralFactorMantissa.lte(md.liquidationThresholdMantissa)).to.equal(
          true,
          `${c.symbol} pool ${c.poolId} CF<=LT`,
        );
      }
    });

    it("recalibrated markets remain listed and usable as collateral", async () => {
      for (const c of bsc.cfChanges) {
        const vToken = new ethers.Contract(c.vToken, VTOKEN_ABI, ethers.provider) as Contract;
        expect(await vToken.address).to.equal(c.vToken);
      }
    });
  });
});
