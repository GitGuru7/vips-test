import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bsctestnet } = NETWORK_ADDRESSES;

// Core pool market: vFDUSD (BNB Chain testnet).
// The Core pool Comptroller is the Unitroller (NETWORK_ADDRESSES.bsctestnet.UNITROLLER).
export const vFDUSD = "0xF06e662a00796c122AaAE935EC4F0Be3F74f5636";

// Current (on-chain) caps, in underlying token decimals (FDUSD = 18).
export const OLD_SUPPLY_CAP = parseUnits("5500000", 18);
export const OLD_BORROW_CAP = parseUnits("4400000", 18);

// New caps = current caps + 25%.
//   supply: 5,500,000 * 1.25 = 6,875,000
//   borrow: 4,400,000 * 1.25 = 5,500,000
export const NEW_SUPPLY_CAP = parseUnits("6875000", 18);
export const NEW_BORROW_CAP = parseUnits("5500000", 18);

export const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain Testnet] Increase vFDUSD (Core pool) supply and borrow caps by 25%",
    description: `#### Summary

Raise the risk parameters of the FDUSD market in the Core pool on BNB Chain testnet by 25%:

- Supply cap: 5,500,000 → 6,875,000 FDUSD
- Borrow cap: 4,400,000 → 5,500,000 FDUSD

#### Details

1. \`_setMarketSupplyCaps([vFDUSD], [6,875,000e18])\` on the Core pool Comptroller
2. \`_setMarketBorrowCaps([vFDUSD], [5,500,000e18])\` on the Core pool Comptroller`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      // ────────────────────────────────────────────────────────────────────────
      // 1. Raise the vFDUSD supply cap by 25%
      // ────────────────────────────────────────────────────────────────────────
      {
        target: bsctestnet.UNITROLLER,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[vFDUSD], [NEW_SUPPLY_CAP]],
      },

      // ────────────────────────────────────────────────────────────────────────
      // 2. Raise the vFDUSD borrow cap by 25%
      // ────────────────────────────────────────────────────────────────────────
      {
        target: bsctestnet.UNITROLLER,
        signature: "_setMarketBorrowCaps(address[],uint256[])",
        params: [[vFDUSD], [NEW_BORROW_CAP]],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
