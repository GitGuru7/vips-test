import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bsctestnet } = NETWORK_ADDRESSES;

// vUSDT market in the Core Pool (BNB Chain Testnet).
export const VUSDT = "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A";

// Current on-chain supply cap, read from Comptroller.supplyCaps(vUSDT):
// 52,319,502,193,790 (USDT has 6 decimals -> 52,319,502.19379 USDT).
export const CURRENT_SUPPLY_CAP: BigNumber = parseUnits("52319502.19379", 6);

// Raise the supply cap by 25% (current x 1.25). Integer math floors the half unit
// (exact x1.25 = 65,399,377,742,237.5 -> 65,399,377,742,237; the 0.0000005 USDT
// remainder is immaterial).
export const NEW_SUPPLY_CAP: BigNumber = CURRENT_SUPPLY_CAP.mul(5).div(4);

// Collateral factor target: 80%. Already 80% on-chain; the VIP re-affirms it.
export const NEW_CF: BigNumber = parseUnits("0.8", 18);

// Liquidation threshold is unchanged at 80% (setCollateralFactor takes both).
export const CURRENT_LT: BigNumber = parseUnits("0.8", 18);

export const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain Testnet] vUSDT Core Pool: increase supply cap by 25% and set collateral factor to 80%",
    description: `#### Summary

If passed, this VIP will strengthen the **vUSDT** market in the Core Pool on BNB Chain Testnet by raising its risk limits:

- Increase the **Supply Cap** by **25%**, from **52,319,502.19379 USDT** to **65,399,377.742237 USDT**.
- Set the **Collateral Factor (CF)** to **80%** (the Liquidation Threshold remains at **80%**).

#### Proposed Changes

- **vUSDT Supply Cap** — Current: 52,319,502.19379 USDT, Proposed: 65,399,377.742237 USDT (+25%)
- **vUSDT Collateral Factor** — Proposed: 80%
- **vUSDT Liquidation Threshold** — 80% (unchanged)

#### Conclusion

Raising the supply cap gives the vUSDT market additional headroom while keeping the collateral factor at 80%.`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      // Raise the vUSDT supply cap by 25%.
      {
        target: bsctestnet.UNITROLLER,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[VUSDT], [NEW_SUPPLY_CAP]],
      },
      // Set the vUSDT collateral factor to 80% (liquidation threshold unchanged at 80%).
      {
        target: bsctestnet.UNITROLLER,
        signature: "setCollateralFactor(address,uint256,uint256)",
        params: [VUSDT, NEW_CF, CURRENT_LT],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
