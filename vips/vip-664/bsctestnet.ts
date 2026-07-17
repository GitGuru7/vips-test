import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { NETWORK_ADDRESSES } from "src/networkAddresses";
import { ProposalType } from "src/types";
import { makeProposal } from "src/utils";

const bsctestnet = NETWORK_ADDRESSES.bsctestnet;
export const { RESILIENT_ORACLE, CHAINLINK_ORACLE } = NETWORK_ADDRESSES.bsctestnet;

export const PROTOCOL_SHARE_RESERVE = "0x25c7c7D6Bf710949fD7f03364E9BA19a1b3c10E3";
export const FLOKI = "0x1253c97BD31fcEC5899E732C300cAF13f1D22dE9";
export const vFLOKI = "0x46F1C4a019AEA44DE9E4Cf7114f172b8BE4E9982";
export const RATE_MODEL = "0x645eEDa11b0486A44140251971599Bb25CFFD208";
export const REDUCE_RESERVES_BLOCK_DELTA = "28800";

// FLOKI is a 9-decimal token. Direct price is set in 18 decimals on the ChainlinkOracle;
// the oracle returns getUnderlyingPrice scaled to (36 - underlyingDecimals) = 27 decimals.
export const FLOKI_DIRECT_PRICE = parseUnits("0.00015", 18);

export const marketSpecs = {
  vToken: {
    address: vFLOKI,
    name: "Venus FLOKI",
    symbol: "vFLOKI",
    underlying: {
      address: FLOKI,
      decimals: 9,
      symbol: "FLOKI",
    },
    decimals: 8,
    exchangeRate: parseUnits("1", 19),
    comptroller: bsctestnet.UNITROLLER,
    isLegacyPool: true,
  },
  interestRateModel: {
    model: "jump",
    baseRatePerYear: "0",
    multiplierPerYear: "0.15",
    jumpMultiplierPerYear: "3",
    kink: "0.5",
  },
  riskParameters: {
    collateralFactor: parseUnits("0.4", 18),
    liquidationThreshold: parseUnits("0.5", 18),
    liquidationIncentive: parseUnits("1.1", 18),
    reserveFactor: parseUnits("0.25", 18),
    supplyCap: parseUnits("40000000000", 9),
    borrowCap: parseUnits("0", 9),
  },
  initialSupply: {
    amount: parseUnits("666660", 9),
    vTokenReceiver: bsctestnet.VTREASURY,
    vTokensToBurn: parseUnits("66666", 8), // 10% of the minted vTokens
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
    title: "VIP-664 [BNB Chain Testnet] Listing of FLOKI in Venus Core Pool",
    description: `## Description

This VIP lists FLOKI in the Venus Core Pool on BNB Chain Testnet as a non-borrowable collateral asset.

## Specification

If approved, FLOKI will be listed in the Venus Core Pool with the following initial parameters:

- Asset: FLOKI
- Chain: BNB Chain Testnet
- Pool: Core Pool
- Collateral Factor: 40%
- Liquidation Threshold: 50%
- Liquidation Bonus: 10%
- Supply Cap: 40,000,000,000 FLOKI
- Borrow Cap: Not enabled
- Borrowable: No (borrow action paused at launch)
- Reserve Factor: 25%

Interest Rate Model (jump):

- Base Rate: 0%
- Multiplier: 15%
- Jump Multiplier: 300%
- Kink: 50%

Oracle:

- ResilientOracle configured with a direct price on the testnet ChainlinkOracle

## Summary

If approved, this VIP will:

- List FLOKI as a non-borrowable collateral asset in the Venus Core Pool on BNB Chain Testnet
- Configure the ResilientOracle for FLOKI via the testnet ChainlinkOracle direct price`,
    forDescription: "I agree that Venus Protocol should proceed with this proposal",
    againstDescription: "I do not think that Venus Protocol should proceed with this proposal",
    abstainDescription: "I am indifferent to whether Venus Protocol proceeds or not",
  };

  return makeProposal(
    [
      // Oracle configuration
      {
        target: CHAINLINK_ORACLE,
        signature: "setDirectPrice(address,uint256)",
        params: [marketSpecs.vToken.underlying.address, FLOKI_DIRECT_PRICE],
      },
      {
        target: RESILIENT_ORACLE,
        signature: "setTokenConfig((address,address[3],bool[3],bool))",
        params: [
          [
            marketSpecs.vToken.underlying.address,
            [CHAINLINK_ORACLE, ethers.constants.AddressZero, ethers.constants.AddressZero],
            [true, false, false],
            false,
          ],
        ],
      },

      // Add Market
      {
        target: marketSpecs.vToken.comptroller,
        signature: "_supportMarket(address)",
        params: [marketSpecs.vToken.address],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "_setMarketSupplyCaps(address[],uint256[])",
        params: [[marketSpecs.vToken.address], [marketSpecs.riskParameters.supplyCap]],
      },

      // Pause borrowing for the vFLOKI market (BORROW action = 2)
      {
        target: marketSpecs.vToken.comptroller,
        signature: "_setActionsPaused(address[],uint8[],bool)",
        params: [[marketSpecs.vToken.address], [2], true],
      },

      // vToken plumbing
      {
        target: marketSpecs.vToken.address,
        signature: "setAccessControlManager(address)",
        params: [bsctestnet.ACCESS_CONTROL_MANAGER],
      },
      {
        target: marketSpecs.vToken.address,
        signature: "setProtocolShareReserve(address)",
        params: [PROTOCOL_SHARE_RESERVE],
      },
      {
        target: marketSpecs.vToken.address,
        signature: "setReduceReservesBlockDelta(uint256)",
        params: [REDUCE_RESERVES_BLOCK_DELTA],
      },
      {
        target: marketSpecs.vToken.address,
        signature: "_setReserveFactor(uint256)",
        params: [marketSpecs.riskParameters.reserveFactor],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "setCollateralFactor(address,uint256,uint256)",
        params: [
          marketSpecs.vToken.address,
          marketSpecs.riskParameters.collateralFactor,
          marketSpecs.riskParameters.liquidationThreshold,
        ],
      },
      {
        target: marketSpecs.vToken.comptroller,
        signature: "setLiquidationIncentive(address,uint256)",
        params: [marketSpecs.vToken.address, marketSpecs.riskParameters.liquidationIncentive],
      },

      // Initial liquidity
      {
        target: FLOKI,
        signature: "faucet(uint256)",
        params: [marketSpecs.initialSupply.amount],
      },
      {
        target: marketSpecs.vToken.underlying.address,
        signature: "approve(address,uint256)",
        params: [marketSpecs.vToken.address, marketSpecs.initialSupply.amount],
      },
      {
        target: marketSpecs.vToken.address,
        signature: "mint(uint256)",
        params: [marketSpecs.initialSupply.amount],
      },
      {
        target: marketSpecs.vToken.underlying.address,
        signature: "approve(address,uint256)",
        params: [marketSpecs.vToken.address, 0],
      },
      // Burn some vTokens to prevent exchange rate manipulation at market launch.
      {
        target: marketSpecs.vToken.address,
        signature: "transfer(address,uint256)",
        params: [ethers.constants.AddressZero, marketSpecs.initialSupply.vTokensToBurn],
      },
      // Transfer leftover vTokens to receiver
      {
        target: marketSpecs.vToken.address,
        signature: "transfer(address,uint256)",
        params: [marketSpecs.initialSupply.vTokenReceiver, vTokensRemaining],
      },
    ],
    meta,
    ProposalType.REGULAR,
  );
};

export default vip664;
