import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalMeta, ProposalType } from "src/types";
import { makeProposal } from "src/utils";

export const vUSDT = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";
export const SUPPLY_CAP = parseUnits("390000000", 18);

const { bscmainnet } = NETWORK_ADDRESSES;

export const vip664 = async () => {
  const meta: ProposalMeta = {
    version: "v2",
    title: "VIP-664 [BNB Chain] Risk Parameters Adjustments (USDT)",
    description: `If passed, this VIP will perform the following change:

- [vUSDT (Core pool)](https://app.venus.io/#/pool/0xfD36E2c2a6789Db23113685031d7F16329158384/market/0xfD5840Cd36d94D7229439859C0112a4185BC0255?chainId=56):
    - decrease supply cap, from 600,000,000 USDT to 390,000,000 USDT`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: bscmainnet.UNITROLLER,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[vUSDT], [SUPPLY_CAP]],
      },
    ],
    meta,
    ProposalType.CRITICAL,
  );
};

export default vip664;
