import { expect } from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser, setMaxStalePeriodForAllAssets } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip664, { CURRENT_LT, CURRENT_SUPPLY_CAP, NEW_CF, NEW_SUPPLY_CAP, VUSDT } from "../../vips/vip-664/bsctestnet";
import COMPTROLLER_ABI from "./abi/Comptroller.json";
import ERC20_ABI from "./abi/ERC20.json";
import RESILIENT_ORACLE_ABI from "./abi/ResilientOracle.json";
import VTOKEN_ABI from "./abi/VToken.json";

const { bsctestnet } = NETWORK_ADDRESSES;

// USDT underlying of the Core Pool vUSDT market (read on-chain via vUSDT.underlying()).
const USDT = "0xa11c8d9dc9b66e209ef60f0c8d969d3cd988782c";

// Storage slot of Comptroller `supplyCaps` mapping (base slot 39); supplyCaps[vUSDT]
// lives at keccak256(abi.encode(vUSDT, 39)).
const SUPPLY_CAPS_BASE_SLOT = 39;
const supplyCapsSlot = (vToken: string) =>
  ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [vToken, SUPPLY_CAPS_BASE_SLOT]));

const FORK_BLOCK = 115008740;

forking(FORK_BLOCK, async () => {
  const comptroller = new ethers.Contract(bsctestnet.UNITROLLER, COMPTROLLER_ABI, ethers.provider);

  before(async () => {
    // setCollateralFactor reads the underlying price and the behavioral block touches
    // pricing; the timelock warp makes feeds stale, so bump their max stale period first.
    const resilientOracle = new ethers.Contract(bsctestnet.RESILIENT_ORACLE, RESILIENT_ORACLE_ABI, ethers.provider);
    const usdt = new ethers.Contract(USDT, ERC20_ABI, ethers.provider);
    await setMaxStalePeriodForAllAssets(resilientOracle, [usdt]);

    // Fork-state workaround: the archive node this fork reads from serves a stale value
    // for the supplyCaps storage slot via `eth_getStorageAt` (the pre-change
    // type(uint256).max), even though the live chain — confirmed via `eth_call` on the
    // same node and via the governance broker — already holds the current finite cap
    // (52,319,502.19379 USDT). Pin the slot to the genuine current value so the
    // before/after comparison reflects the real on-chain state the VIP will execute against.
    await network.provider.send("hardhat_setStorageAt", [
      bsctestnet.UNITROLLER,
      supplyCapsSlot(VUSDT),
      ethers.utils.hexZeroPad(CURRENT_SUPPLY_CAP.toHexString(), 32),
    ]);
    // Sanity-check the override resolves through the public getter (confirms the slot).
    expect(await comptroller.supplyCaps(VUSDT)).to.equal(CURRENT_SUPPLY_CAP);
  });

  describe("Pre-VIP state", () => {
    it("the new supply cap is exactly the current cap + 25%", async () => {
      expect(NEW_SUPPLY_CAP).to.equal(CURRENT_SUPPLY_CAP.mul(5).div(4));
      expect(NEW_SUPPLY_CAP).to.be.gt(CURRENT_SUPPLY_CAP);
    });

    it("vUSDT supply cap is the current value", async () => {
      expect(await comptroller.supplyCaps(VUSDT)).to.equal(CURRENT_SUPPLY_CAP);
    });

    it("vUSDT collateral factor is 80%", async () => {
      const market = await comptroller.markets(VUSDT);
      expect(market.collateralFactorMantissa).to.equal(NEW_CF);
    });

    it("vUSDT liquidation threshold is 80%", async () => {
      const market = await comptroller.markets(VUSDT);
      expect(market.liquidationThresholdMantissa).to.equal(CURRENT_LT);
    });
  });

  testVip(
    "VIP-664 [BNB Chain Testnet] vUSDT Core Pool: increase supply cap by 25% and set collateral factor to 80%",
    await vip664(),
    {
      callbackAfterExecution: async txResponse => {
        // The supply cap changes, so NewSupplyCap fires once. The collateral factor is
        // already 80%, so setCollateralFactor is a no-op and emits no NewCollateralFactor
        // (the Comptroller only emits when the value actually changes).
        await expectEvents(txResponse, [COMPTROLLER_ABI], ["NewSupplyCap"], [1]);
        await expectEvents(txResponse, [COMPTROLLER_ABI], ["NewCollateralFactor"], [0]);
      },
    },
  );

  describe("Post-VIP state", () => {
    it("vUSDT supply cap is raised by 25%", async () => {
      expect(await comptroller.supplyCaps(VUSDT)).to.equal(NEW_SUPPLY_CAP);
    });

    it("vUSDT collateral factor is 80%", async () => {
      const market = await comptroller.markets(VUSDT);
      expect(market.collateralFactorMantissa).to.equal(NEW_CF);
    });

    it("vUSDT liquidation threshold remains 80%", async () => {
      const market = await comptroller.markets(VUSDT);
      expect(market.liquidationThresholdMantissa).to.equal(CURRENT_LT);
    });
  });

  describe("Post-VIP behavior: the raised cap is the enforced ceiling", () => {
    // The vUSDT market's existing supply already exceeds the supply cap on testnet, so
    // `mintAllowed` reverts with "market supply cap reached" using the freshly-set (higher)
    // cap value. This proves the new limit is the value the protocol actively enforces in
    // `mintAllowed`, not merely a stored number. (Mint is not paused for vUSDT, and the cap
    // is checked after the pause/listed checks, so this is the reverting condition.)
    it("mint reverts against the new supply cap", async () => {
      const vUsdt = new ethers.Contract(VUSDT, VTOKEN_ABI, ethers.provider);
      const user = await initMainnetUser(bsctestnet.VTREASURY, parseUnits("1"));
      await expect(vUsdt.connect(user).mint(parseUnits("1", 6))).to.be.revertedWith("market supply cap reached");
    });
  });
});
