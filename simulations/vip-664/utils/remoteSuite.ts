import { expect } from "chai";
import { Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { initMainnetUser } from "src/utils";
import { forking, testForkedNetworkVipCommands } from "src/vip-framework";

import { getAuxiliaryAggregator, seedAuxiliaryAggregator } from "../../../src/auxiliaryCommandsAggregator";
import vip664 from "../../../vips/vip-664/bscmainnet";
import { CFEntry, OffboardEntry } from "../../../vips/vip-664/types";
import { RemoteChainKey, buildSeedBatch } from "../../../vips/vip-664/utils/seed-batch";
import CHAINLINK_ORACLE_ABI from "../abi/ChainlinkOracle.json";
import COMPTROLLER_ABI from "../abi/Comptroller.json";
import RESILIENT_ORACLE_ABI from "../abi/ResilientOracle.json";
import VTOKEN_ABI from "../abi/VToken.json";
import ACM_ABI from "../abi/accessControlManager.json";

// An authorized batcher on every new (VIP-628) aggregator — used to pre-seed the batch on
// the fork the way the off-chain batcher EOA seeds it on mainnet before the VIP is proposed.
const AUTHORIZED_BATCHER = "0x080f8a0fb70f8f0f1b83c6178225a96cbe2be0de";
const ALL_ACTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export interface RemoteData {
  COMPTROLLER: string;
  cfChanges: CFEntry[];
  crvUSDOffboard?: OffboardEntry;
}

// Pin each touched asset's price (read fresh at the fork block) through the Chainlink oracle
// so setCollateralFactor's price lookup stays valid (CF changes only require a non-zero price).
const pinOraclePrices = async (chainKey: RemoteChainKey, data: RemoteData) => {
  const addrs = NETWORK_ADDRESSES[chainKey];
  const resilient = new ethers.Contract(addrs.RESILIENT_ORACLE, RESILIENT_ORACLE_ABI, ethers.provider);
  const chainlink = new ethers.Contract(addrs.CHAINLINK_ORACLE, CHAINLINK_ORACLE_ABI, ethers.provider);
  const admin = await initMainnetUser(addrs.NORMAL_TIMELOCK, ethers.utils.parseEther("2"));

  const vTokens = new Set<string>([
    ...data.cfChanges.map(c => c.vToken),
    ...(data.crvUSDOffboard ? [data.crvUSDOffboard.vToken] : []),
  ]);
  for (const vToken of vTokens) {
    const underlying = ethers.utils.getAddress(
      await new ethers.Contract(vToken, VTOKEN_ABI, ethers.provider).underlying(),
    );
    await chainlink.connect(admin).setDirectPrice(underlying, parseUnits("1", 18));
    await resilient.connect(admin).setTokenConfig({
      asset: underlying,
      oracles: [addrs.CHAINLINK_ORACLE, ethers.constants.AddressZero, ethers.constants.AddressZero],
      enableFlagsForOracles: [true, false, false],
      cachingEnabled: false,
    });
  }
};

export const runRemoteCfSuite = (chainKey: RemoteChainKey, blockNumber: number, data: RemoteData) => {
  const addrs = NETWORK_ADDRESSES[chainKey];
  const aggregator = getAuxiliaryAggregator(chainKey);

  forking(blockNumber, async () => {
    let comptroller: Contract;
    let acm: Contract;

    before(async () => {
      comptroller = new ethers.Contract(data.COMPTROLLER, COMPTROLLER_ABI, ethers.provider);
      acm = new ethers.Contract(addrs.ACCESS_CONTROL_MANAGER, ACM_ABI, ethers.provider);
      // Seed the aggregator batch at index 0 on the fork (mirrors the off-chain batcher EOA).
      const batcher = await initMainnetUser(AUTHORIZED_BATCHER, ethers.utils.parseEther("1"));
      await seedAuxiliaryAggregator(buildSeedBatch(chainKey), 0, batcher, chainKey);
      await pinOraclePrices(chainKey, data);
    });

    describe(`Pre-VIP state (${chainKey})`, () => {
      it("matches current collateral factors and liquidation thresholds", async () => {
        for (const c of data.cfChanges) {
          const md = await comptroller.markets(c.vToken);
          expect(md.collateralFactorMantissa.toString()).to.equal(c.oldCF.toString(), `${c.symbol} CF`);
          expect(md.liquidationThresholdMantissa.toString()).to.equal(c.oldLT.toString(), `${c.symbol} LT`);
        }
      });

      if (data.crvUSDOffboard) {
        const o = data.crvUSDOffboard;
        it("crvUSD starts with CF 0 and non-zero caps", async () => {
          const md = await comptroller.markets(o.vToken);
          expect(md.collateralFactorMantissa.toString()).to.equal("0", "crvUSD CF");
          expect((await comptroller.supplyCaps(o.vToken)).toString()).to.equal(o.oldSupplyCap.toString(), "supplyCap");
          expect((await comptroller.borrowCaps(o.vToken)).toString()).to.equal(o.oldBorrowCap.toString(), "borrowCap");
        });
      }

      it("aggregator holds no admin role pre-VIP", async () => {
        expect(await acm.hasRole(ethers.constants.HashZero, aggregator)).to.equal(false);
      });
    });

    testForkedNetworkVipCommands(`VIP-664 ${chainKey}`, await vip664());

    describe(`Post-VIP state (${chainKey})`, () => {
      it("applies new collateral factors and liquidation thresholds (-2pp each)", async () => {
        for (const c of data.cfChanges) {
          const md = await comptroller.markets(c.vToken);
          expect(md.collateralFactorMantissa.toString()).to.equal(c.newCF.toString(), `${c.symbol} CF`);
          expect(md.liquidationThresholdMantissa.toString()).to.equal(c.newLT.toString(), `${c.symbol} LT`);
        }
      });

      it("keeps CF <= LT on every recalibrated market", async () => {
        for (const c of data.cfChanges) {
          const md = await comptroller.markets(c.vToken);
          expect(md.collateralFactorMantissa.lte(md.liquidationThresholdMantissa)).to.equal(true, `${c.symbol} CF<=LT`);
        }
      });

      if (data.crvUSDOffboard) {
        const o = data.crvUSDOffboard;
        it("crvUSD fully off-boarded: all actions paused, both caps zeroed", async () => {
          for (const action of ALL_ACTIONS) {
            expect(await comptroller.actionPaused(o.vToken, action)).to.equal(true, `crvUSD action ${action} paused`);
          }
          expect((await comptroller.supplyCaps(o.vToken)).toString()).to.equal("0", "crvUSD supplyCap");
          expect((await comptroller.borrowCaps(o.vToken)).toString()).to.equal("0", "crvUSD borrowCap");
        });
      }

      it("aggregator admin role self-revoked post-VIP", async () => {
        expect(await acm.hasRole(ethers.constants.HashZero, aggregator)).to.equal(false);
      });
    });
  });
};
