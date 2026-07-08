import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const bsctestnet = NETWORK_ADDRESSES.bsctestnet;
export const { RESILIENT_ORACLE, CHAINLINK_ORACLE } = NETWORK_ADDRESSES.bsctestnet;

export const PROTOCOL_SHARE_RESERVE = "0x25c7c7D6Bf710949fD7f03364E9BA19a1b3c10E3";
export const UXRP = "0xf03EFE33Fd88A7d651C05B5Ce0F23aa9DC58d9D1";
export const vUXRP = "0xAc83A3f908d2Ff129D36D7A217A1fEE4d5B0ca88";
export const RATE_MODEL = "0x1CcDaf39085bae4e27c3Ba100561b1AD1B5A6b80";
export const REDUCE_RESERVES_BLOCK_DELTA = "28800";

// Core pool id (EIP-2535 Diamond Comptroller). Borrowing must be explicitly enabled per market.
export const CORE_POOL_ID = 0;

// UXRP price used to seed the Chainlink oracle direct price ($2.50).
export const UXRP_PRICE = parseUnits("2.5", 18);

export const marketSpecs = {
  vToken: {
    address: vUXRP,
    name: "Venus UXRP",
    symbol: "vUXRP",
    underlying: {
      address: UXRP,
      decimals: 18,
      symbol: "UXRP",
    },
    decimals: 8,
    exchangeRate: parseUnits("1", 28),
    comptroller: bsctestnet.UNITROLLER,
    isLegacyPool: true,
  },
  interestRateModel: {
    address: RATE_MODEL,
    base: "0",
    multiplier: "0.0667",
    jump: "6.27",
    kink: "0.75",
  },
  initialSupply: {
    amount: parseUnits("0.26", 18),
    vTokenReceiver: bsctestnet.VTREASURY,
    vTokensToBurn: parseUnits("0.24", 8),
  },
  riskParameters: {
    collateralFactor: parseUnits("0.6", 18),
    liquidationThreshold: parseUnits("0.7", 18),
    liquidationIncentive: parseUnits("1.1", 18),
    reserveFactor: parseUnits("0.25", 18),
    supplyCap: parseUnits("236", 18),
    borrowCap: parseUnits("236", 18),
  },
};

export const convertAmountToVTokens = (amount: BigNumber, exchangeRate: BigNumber) => {
  const EXP_SCALE = parseUnits("1", 18);
  return amount.mul(EXP_SCALE).div(exchangeRate);
};

const vTokensMinted = convertAmountToVTokens(marketSpecs.initialSupply.amount, marketSpecs.vToken.exchangeRate);
export const vTokensRemaining = vTokensMinted.sub(marketSpecs.initialSupply.vTokensToBurn);

export const vip664 = () => {
  const meta = {
    version: "v2",
    title: "VIP-664 [BNB Chain] Listing of UXRP in Venus Core Pool",
    description: `## Description

This VIP lists UXRP in the Venus Core Pool on BNB Chain as a borrowable collateral asset.

## Specification

If approved, UXRP will be listed in the Venus Core Pool with the following initial parameters:

- Asset: UXRP
- Chain: BNB Chain
- Pool: Core Pool
- Collateral Factor: 60%
- Liquidation Threshold: 70%
- Liquidation Incentive: 10%
- Reserve Factor: 25%
- Supply Cap: 236 UXRP
- Borrow Cap: 236 UXRP
- Usable as collateral: Yes
- Borrowing: Enabled

Interest Rate Model (Jump):

- Base Rate: 0%
- Multiplier: 6.67%
- Jump Multiplier: 627%
- Kink: 75%

Oracle:

- Chainlink integration via Resilient Oracle

## Summary

If approved, this VIP will:

- List UXRP as a borrowable collateral asset in the Venus Core Pool
- Integrate the Chainlink price feed via the Resilient Oracle`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      // ──────────────────────────────────────────────────────────────────────
      // 1. Oracle configuration
      // ──────────────────────────────────────────────────────────────────────
      {
        target: CHAINLINK_ORACLE,
        signature: "setDirectPrice(address,uint256)",
        params: [UXRP, UXRP_PRICE],
      },
      {
        target: RESILIENT_ORACLE,
        signature: "setTokenConfig((address,address[3],bool[3],bool))",
        params: [
          [
            UXRP,
            [CHAINLINK_ORACLE, ethers.constants.AddressZero, ethers.constants.AddressZero],
            [true, false, false],
            false,
          ],
        ],
      },

      // ──────────────────────────────────────────────────────────────────────
      // 2. List market + caps
      // ──────────────────────────────────────────────────────────────────────
      {
        target: marketSpecs.vToken.comptroller,
        signature: "_supportMarket(address)",
        params: [vUXRP],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[vUXRP], [marketSpecs.riskParameters.supplyCap]],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "_setMarketBorrowCaps(address[],uint256[])",
        params: [[vUXRP], [marketSpecs.riskParameters.borrowCap]],
      },

      // ──────────────────────────────────────────────────────────────────────
      // 3. vToken configuration
      // ──────────────────────────────────────────────────────────────────────
      {
        target: vUXRP,
        signature: "setAccessControlManager(address)",
        params: [bsctestnet.ACCESS_CONTROL_MANAGER],
      },
      {
        target: vUXRP,
        signature: "setProtocolShareReserve(address)",
        params: [PROTOCOL_SHARE_RESERVE],
      },
      {
        target: vUXRP,
        signature: "setReduceReservesBlockDelta(uint256)",
        params: [REDUCE_RESERVES_BLOCK_DELTA],
      },
      {
        target: vUXRP,
        signature: "_setReserveFactor(uint256)",
        params: [marketSpecs.riskParameters.reserveFactor],
      },

      // ──────────────────────────────────────────────────────────────────────
      // 4. Risk parameters (CF / LT / liquidation incentive) + enable borrowing
      // ──────────────────────────────────────────────────────────────────────
      {
        target: marketSpecs.vToken.comptroller,
        signature: "setCollateralFactor(address,uint256,uint256)",
        params: [vUXRP, marketSpecs.riskParameters.collateralFactor, marketSpecs.riskParameters.liquidationThreshold],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "setLiquidationIncentive(address,uint256)",
        params: [vUXRP, marketSpecs.riskParameters.liquidationIncentive],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "setIsBorrowAllowed(uint96,address,bool)",
        params: [CORE_POOL_ID, vUXRP, true],
      },

      // ──────────────────────────────────────────────────────────────────────
      // 5. Bootstrap initial liquidity (prevents exchange-rate manipulation)
      // ──────────────────────────────────────────────────────────────────────
      {
        target: UXRP,
        signature: "faucet(uint256)",
        params: [marketSpecs.initialSupply.amount],
      },
      {
        target: UXRP,
        signature: "approve(address,uint256)",
        params: [vUXRP, marketSpecs.initialSupply.amount],
      },
      {
        target: vUXRP,
        signature: "mint(uint256)",
        params: [marketSpecs.initialSupply.amount],
      },
      {
        target: UXRP,
        signature: "approve(address,uint256)",
        params: [vUXRP, 0],
      },
      // Burn a portion of the minted vTokens to prevent exchange-rate manipulation at market launch.
      {
        target: vUXRP,
        signature: "transfer(address,uint256)",
        params: [ethers.constants.AddressZero, marketSpecs.initialSupply.vTokensToBurn],
      },
      // Transfer the remaining vTokens to the Treasury.
      {
        target: vUXRP,
        signature: "transfer(address,uint256)",
        params: [marketSpecs.initialSupply.vTokenReceiver, vTokensRemaining],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
