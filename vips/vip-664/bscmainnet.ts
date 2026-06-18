import { parseUnits } from "ethers/lib/utils";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

export const COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384";
export const vUSDT = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";

export const OLD_USDT_SUPPLY_CAP = parseUnits("600000000", 18);
export const NEW_USDT_SUPPLY_CAP = parseUnits("320000000", 18);

export const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain] Risk Parameters Adjustment (USDT Supply Cap)",
    description: `#### Summary

If passed, this VIP will set the supply cap of the **USDT** market in the Core Pool on BNB Chain to **320,000,000 USDT**.

#### Description

- [USDT (Core pool)](https://bscscan.com/address/0xfD5840Cd36d94D7229439859C0112a4185BC0255)
    - Set supply cap, from 600M USDT to 320M USDT`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: COMPTROLLER,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[vUSDT], [NEW_USDT_SUPPLY_CAP]],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
