import { parseUnits } from "ethers/lib/utils";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

// Core pool Comptroller (Unitroller) on BNB Chain.
export const COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384";

// vUSDT market on the BNB Chain Core pool (underlying USDT, 18 decimals).
export const vUSDT = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";

// Current on-chain supply cap (reference for the pre-VIP check) and the new, raised cap.
export const OLD_SUPPLY_CAP = parseUnits("600000000", 18); // 600M USDT
export const NEW_SUPPLY_CAP = parseUnits("800000000", 18); // 800M USDT

const vip633 = () => {
  const meta = {
    version: "v2",
    title: "VIP-633 [BNB Chain] Raise vUSDT Supply Cap to 800M",
    description: `#### Summary

This VIP raises the supply cap of the USDT market on the BNB Chain Core pool from 600,000,000 USDT to 800,000,000 USDT, adding deposit headroom for the market. No other risk parameter is changed.

#### Description

The USDT (vUSDT) market on the BNB Chain Core pool currently has a supply cap of 600,000,000 USDT, with roughly 200,000,000 USDT supplied today — well below the existing cap. This proposal increases the supply cap to 800,000,000 USDT so the market can accept additional deposits as demand grows.

The borrow cap (450,000,000 USDT), collateral factor, liquidation threshold, interest-rate model, pause flags and oracle configuration are all left unchanged. The change only widens the amount of USDT that can be supplied to the market; it does not affect any existing position.

#### Actions

This VIP performs the following action on BNB Chain:

1. **Raise vUSDT supply cap** — Calls setMarketSupplyCaps([${vUSDT}], [${NEW_SUPPLY_CAP.toString()}]) on the Core pool Comptroller (${COMPTROLLER}), setting the USDT supply cap to 800,000,000 USDT (scaled to 1e18 for an 18-decimal asset).`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      {
        target: COMPTROLLER,
        signature: "setMarketSupplyCaps(address[],uint256[])",
        params: [[vUSDT], [NEW_SUPPLY_CAP]],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip633;
