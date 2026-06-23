import { BigNumber } from "ethers";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bsctestnet } = NETWORK_ADDRESSES;

// vUSDT market in the Core Pool on BNB Chain Testnet.
export const VUSDT = "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A";

// Current on-chain borrow cap (USDT has 6 decimals): 52,319,502.193790 USDT.
export const CURRENT_BORROW_CAP = BigNumber.from("52319502193790");

// New borrow cap: +25% => floor(52319502193790 * 125 / 100) = 65,399,377.742237 USDT.
export const NEW_BORROW_CAP = BigNumber.from("65399377742237");

export const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain Testnet] Raise vUSDT (Core Pool) Borrow Cap by 25%",
    description: `#### Summary

If passed, this VIP will raise the **borrow cap** of the **vUSDT** market in the Core Pool on BNB Chain Testnet by **25%**, from **52,319,502.193790 USDT** to **65,399,377.742237 USDT**.

#### Motivation

This is a routine risk-parameter adjustment that increases the aggregate USDT borrow capacity of the Core Pool by ~13M USDT, allowing more total borrows against the vUSDT market.

#### Proposed Changes

- **vUSDT Borrow Cap** — Current: 52,319,502.193790 USDT, Proposed: 65,399,377.742237 USDT (+25%)

#### Supply Cap

The supply cap of vUSDT is currently set to \`type(uint256).max\` on-chain, i.e. the supply cap is effectively unlimited and is not enforced. Raising an unlimited cap by 25% would overflow and would have no behavioral effect, so this VIP does not modify the supply cap; the market already accepts supply without an upper bound.

#### Conclusion

This update raises the vUSDT borrow cap by 25% while leaving the (already unlimited) supply cap unchanged.`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: bsctestnet.UNITROLLER,
        signature: "_setMarketBorrowCaps(address[],uint256[])",
        params: [[VUSDT], [NEW_BORROW_CAP]],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
