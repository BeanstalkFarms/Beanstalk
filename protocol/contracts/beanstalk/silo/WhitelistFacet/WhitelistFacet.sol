/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
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
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint16 stalkIssuedPerBdv,
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
    
}
