import { expect } from "chai";
import { Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { expectEvents, initMainnetUser } from "src/utils";
import { forking, testVip } from "src/vip-framework";

import vip664, {
  NEW_BORROW_CAP,
  NEW_SUPPLY_CAP,
  OLD_BORROW_CAP,
  OLD_SUPPLY_CAP,
  vFDUSD,
} from "../../vips/vip-664/bsctestnet";
import COMPTROLLER_ABI from "./abi/Comptroller.json";
import FAUCET_TOKEN_ABI from "./abi/FaucetToken.json";
import VBEP20_ABI from "./abi/VBep20.json";

const { bsctestnet } = NETWORK_ADDRESSES;

// vFDUSD underlying (MockFDUSD — a faucet token, 18 decimals).
const FDUSD = "0xcF27439fA231af9931ee40c4f27Bb77B83826F3C";

const BLOCK_NUMBER = 99316719;

// Two impersonated suppliers (any EOA can be impersonated on a fork).
const SUPPLIER_PRE = "0x1111111111111111111111111111111111111111";
const SUPPLIER_POST = "0x2222222222222222222222222222222222222222";

// Current supplied underlying on this market is ~100k FDUSD. A 6,000,000 FDUSD mint therefore
// pushes the total supplied (~6.1M) above the OLD supply cap (5.5M) but keeps it within the NEW
// cap (6.875M) — so the identical mint reverts pre-VIP and succeeds post-VIP.
const MINT_AMOUNT = parseUnits("6000000", 18);

const EXCHANGE_RATE_SCALE = parseUnits("1", 18);

forking(BLOCK_NUMBER, async () => {
  let comptroller: Contract;
  let vFdusd: Contract;
  let fdusd: Contract;

  before(async () => {
    comptroller = new ethers.Contract(bsctestnet.UNITROLLER, COMPTROLLER_ABI, ethers.provider);
    vFdusd = new ethers.Contract(vFDUSD, VBEP20_ABI, ethers.provider);
    fdusd = new ethers.Contract(FDUSD, FAUCET_TOKEN_ABI, ethers.provider);
  });

  describe("Pre-VIP behavior", () => {
    it("vFDUSD supply cap is 5,500,000", async () => {
      expect(await comptroller.supplyCaps(vFDUSD)).to.equal(OLD_SUPPLY_CAP);
    });

    it("vFDUSD borrow cap is 4,400,000", async () => {
      expect(await comptroller.borrowCaps(vFDUSD)).to.equal(OLD_BORROW_CAP);
    });

    it("a supply that exceeds the old cap reverts with 'market supply cap reached'", async () => {
      const supplier = await initMainnetUser(SUPPLIER_PRE, parseUnits("1"));
      await fdusd.connect(supplier).faucet(MINT_AMOUNT);
      await fdusd.connect(supplier).approve(vFDUSD, MINT_AMOUNT);
      await expect(vFdusd.connect(supplier).mint(MINT_AMOUNT)).to.be.revertedWith("market supply cap reached");
    });
  });

  testVip("VIP-664 Increase vFDUSD supply and borrow caps by 25%", await vip664(), {
    callbackAfterExecution: async txResponse => {
      await expectEvents(txResponse, [COMPTROLLER_ABI], ["NewSupplyCap", "NewBorrowCap"], [1, 1]);
    },
  });

  describe("Post-VIP behavior", () => {
    it("vFDUSD supply cap raised to 6,875,000 (+25%)", async () => {
      expect(await comptroller.supplyCaps(vFDUSD)).to.equal(NEW_SUPPLY_CAP);
    });

    it("vFDUSD borrow cap raised to 5,500,000 (+25%)", async () => {
      expect(await comptroller.borrowCaps(vFDUSD)).to.equal(NEW_BORROW_CAP);
    });

    it("new caps are exactly the old caps + 25%", async () => {
      expect(NEW_SUPPLY_CAP).to.equal(OLD_SUPPLY_CAP.mul(125).div(100));
      expect(NEW_BORROW_CAP).to.equal(OLD_BORROW_CAP.mul(125).div(100));
    });
  });

  describe("Post-VIP functional: a user can supply up to the new (higher) cap", () => {
    it("the supply that reverted under the old cap now succeeds", async () => {
      const supplier = await initMainnetUser(SUPPLIER_POST, parseUnits("1"));
      await fdusd.connect(supplier).faucet(MINT_AMOUNT);
      await fdusd.connect(supplier).approve(vFDUSD, MINT_AMOUNT);

      const balBefore = await vFdusd.balanceOf(SUPPLIER_POST);
      await expect(vFdusd.connect(supplier).mint(MINT_AMOUNT)).to.not.be.reverted;
      expect(await vFdusd.balanceOf(SUPPLIER_POST)).to.be.gt(balBefore);
    });

    it("total supplied underlying now exceeds the old cap but stays within the new cap", async () => {
      const totalSupply = await vFdusd.totalSupply();
      const exchangeRate = await vFdusd.exchangeRateStored();
      const suppliedUnderlying = exchangeRate.mul(totalSupply).div(EXCHANGE_RATE_SCALE);
      expect(suppliedUnderlying).to.be.gt(OLD_SUPPLY_CAP);
      expect(suppliedUnderlying).to.be.lte(NEW_SUPPLY_CAP);
    });
  });
});
