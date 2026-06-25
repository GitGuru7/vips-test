import { parseUnits } from "ethers/lib/utils";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const { bscmainnet } = NETWORK_ADDRESSES;

export const COMPTROLLER_CORE = bscmainnet.UNITROLLER;
export const vUSDT = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";
export const NEW_USDT_SUPPLY_CAP = parseUnits("390000000", 18);

const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain] Risk Parameters Adjustments (vUSDT Supply Cap)",
    description: `#### Summary

If passed, this VIP will set the supply cap of the USDT market in the Core Pool on BNB Chain to 390,000,000 USDT (from 600,000,000 USDT).

#### Proposed Changes

- [USDT (Core pool)](https://bscscan.com/address/0xfD5840Cd36d94D7229439859C0112a4185BC0255): reduce supply cap from 600,000,000 USDT to 390,000,000 USDT`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: COMPTROLLER_CORE,
        signature: "setMarketSupplyCaps(address[],uint256[])",
        params: [[vUSDT], [NEW_USDT_SUPPLY_CAP]],
      },
    ],
    meta,
    ProposalType.FAST_TRACK,
  );
};

export default vip664;
