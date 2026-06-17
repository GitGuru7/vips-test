import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bscmainnet } = NETWORK_ADDRESSES;

// vUSDT market in the Venus Core Pool on BNB Chain.
export const VUSDT = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";

// New supply cap: 350,000,000 USDT. USDT on BNB Chain has 18 decimals.
export const NEW_SUPPLY_CAP = parseUnits("350000000", 18);

export const vip633 = () => {
  const meta = {
    version: "v2",
    title: "VIP-633 [BNB Chain] Set vUSDT Supply Cap to 350M in Core Pool",
    description: `#### Summary

If passed, this VIP sets the supply cap of the **vUSDT** market in the **Venus Core Pool on BNB Chain** to **350,000,000 USDT**.

#### Proposed Changes

- **[vUSDT (Core Pool)](https://bscscan.com/address/0xfD5840Cd36d94D7229439859C0112a4185BC0255)** — set supply cap to 350,000,000 USDT (current on-chain cap: 600,000,000 USDT).

The change is applied via a single \`setMarketSupplyCaps\` call on the Core Pool Comptroller (Unitroller).`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: bscmainnet.UNITROLLER,
        signature: "setMarketSupplyCaps(address[],uint256[])",
        params: [[VUSDT], [NEW_SUPPLY_CAP]],
      },
    ],
    meta,
    ProposalType.FAST_TRACK,
  );
};

export default vip633;
