/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {WhitelistedTokens} from "contracts/beanstalk/silo/WhitelistFacet/WhitelistedTokens.sol";

/**
 * @author Publius
 * @title Whitelist Facet
 * @notice Manages the Silo Whitelist including Adding to, Updating
 * and Removing from the Silo Whitelist
 **/
contract WhitelistFacet is WhitelistedTokens {
    /**
     * @notice Removes a token from the Silo Whitelist.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function dewhitelistToken(address token) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.dewhitelistToken(token);
    }

    /**
     * @notice Adds a token to the Silo Whitelist.
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param gaugePointSelector The function selector that is used to calculate the Gauge Points of the token.
     * @param liquidityWeightSelector The function selector that outputs the liquidity weight of the token.
     * @param gaugePoints The inital gauge points allocated to the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token. Only used if the token is an LP token.
     * @dev
     * Can only be called by Beanstalk or Beanstalk owner.
     * Assumes an `encodeType` of 0.
     * Assumes the token uses a gaugePoint, LiquidityWeight, and oracle implmentation in the beanstalk contract.
     * Non standard implmentations should use {whitelistTokenWithExternalImplmenation}
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            0x00,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @notice Adds a token to the Silo Whitelist with an `encodeType`
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param encodeType The encode type that should be used to encode the BDV function call. See {LibTokenSilo.beanDenominatedValue}.
     * @param gaugePointSelector The function selector that is used to calculate the Gauge Points of the token.
     * @param gaugePoints The inital gauge points allocated to the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token. Only used if the token is an LP token.
     *
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function whitelistTokenWithEncodeType(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            encodeType,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @notice Adds a token to the Silo Whitelist with an external implmentation.
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param encodeType The encode type that should be used to encode the BDV function call. See {LibTokenSilo.beanDenominatedValue}.
     * @param oracleImplmentation The implmentation of the oracle that should be used to fetch the token price.
     * @param gaugePointImplmentation The implmentation of the gauge point function that should be used to calculate the gauge points.
     * @param liquidityWeightImplmentation The implmentation of the liquidity weight function that should be used to calculate the liquidity weight.
     * @dev If the implmentation addresses are 0, then beanstalk calls the selector on itself.
     * See {LibWhitelist.whitelistTokenWithExternalImplmenation} for more info on implmentation.
     * The selector MUST be a view function that returns an uint256 for all implmentation.
     * The oracleImplmentation selector should take:
     *  - `lookback` parameter 
     *  (foo(uint256)).
     * The gaugePointImplmentation selector should take:
     *  - current gauge points, 
     *  - optimal deposited bdv, 
     *  - percent depositedbdv 
     * (foo(uint256, uint256, uint256)).
     * The liquidityWeightImplmentation selector should take no parameters.
     * (foo()).
     */
    function whitelistTokenWithExternalImplmenation(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        Storage.Implmentation memory oracleImplmentation,
        Storage.Implmentation memory gaugePointImplmentation,
        Storage.Implmentation memory liquidityWeightImplmentation
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistTokenWithExternalImplmenation(
            token,
            selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            encodeType,
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplmentation,
            gaugePointImplmentation,
            liquidityWeightImplmentation
        );
    }

    /**
     * @notice Updates the Stalk Per BDV Per Season for a given Token
     * @param token Address of the token that is being Whitelisted.
     * @param stalkEarnedPerSeason The new amount of Stalk earned per Season for each Deposited BDV.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(token, stalkEarnedPerSeason);
    }

    /**
     * @notice Updates gauge settings for token.
     * @dev {LibWhitelistedTokens} must be updated to include the new token.
     */
    function updateGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint64 optimalPercentDepositedBdv
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateGaugeForToken(
            token,
            gaugePointSelector,
            liquidityWeightSelector,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @notice Updates the Oracle Implmentation for a given Token.
     */
    function updateOracleImplmentationForToken(
        address token,
        Storage.Implmentation memory impl
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateOracleImplmentationForToken(token, impl);
    }

    /**
     * @notice Updates the Liquidity Weight Implmentation for a given Token.
     */
    function updateLiqudityWeightImplmentationForToken(
        address token,
        Storage.Implmentation memory impl
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateLiqudityWeightImplmentationForToken(token, impl);
    }

    /**
     * @notice Updates the Gauge Point Implmentation for a given Token.
     */
    function updateGaugePointImplmentationForToken(
        address token,
        Storage.Implmentation memory impl
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateGaugePointImplmentationForToken(token, impl);
    }
}
