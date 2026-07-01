import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalMeta, ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bscmainnet } = NETWORK_ADDRESSES;

export const vUSDT_CORE = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";
export const vUSDT_CORE_SUPPLY_CAP = parseUnits("100000000", 18);

export const vip664 = async () => {
  const meta: ProposalMeta = {
    version: "v2",
    title: "VIP-664 [BNB Chain] Risk Parameters Adjustment (USDT Supply Cap)",
    description: `If passed, this VIP will update the supply cap of the USDT market in the Core pool on BNB Chain:

- [USDT (Core pool)](https://app.venus.io/#/core-pool/market/0xfD5840Cd36d94D7229439859C0112a4185BC0255?chainId=56): decrease the Supply Cap, from 600,000,000 USDT to 100,000,000 USDT

Lowering the supply cap below the current supplied amount blocks new USDT deposits into the Core pool market until the outstanding supply falls under the new cap. Existing suppliers can continue to redeem, and all other market actions remain unchanged.`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: bscmainnet.UNITROLLER,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[vUSDT_CORE], [vUSDT_CORE_SUPPLY_CAP]],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
