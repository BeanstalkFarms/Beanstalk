/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {WhitelistedTokens} from "contracts/beanstalk/silo/WhitelistFacet/WhitelistedTokens.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {SeedGaugeSettings} from "contracts/beanstalk/storage/System.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";

/**
 * @author Publius
 * @title Whitelist Facet
 * @notice Manages the Silo Whitelist including Adding to, Updating
 * and Removing from the Silo Whitelist
 **/
contract WhitelistFacet is Invariable, WhitelistedTokens, ReentrancyGuard {
    /**
     * @notice emitted when {SeedGaugeSettings} is updated.
     */
    event UpdatedSeedGaugeSettings(SeedGaugeSettings);

    /**
     * @notice Removes a token from the Silo Whitelist.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function dewhitelistToken(address token) external payable fundsSafu noNetFlow noSupplyChange {
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
     * @param gaugePoints The initial gauge points allocated to the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token. Only used if the token is an LP token.
     * @dev
     * Can only be called by Beanstalk or Beanstalk owner.
     * Assumes an `encodeType` of 0.
     * Assumes the token uses a gaugePoint, LiquidityWeight, and oracle implementation in the beanstalk contract.
     * Non standard implementations should use {whitelistTokenWithExternalImplementation}
     * Note: The Beanstalk DAO should not whitelist Fee-on-transfer or rebasing tokens,
     * as the Silo is not compatible with these tokens.
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        Implementation memory oracleImplementation
    ) external payable fundsSafu noNetFlow noSupplyChange {
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
            optimalPercentDepositedBdv,
            oracleImplementation
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
     * @param gaugePoints The initial gauge points allocated to the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token. Only used if the token is an LP token.
     *
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     * Note: The Beanstalk DAO should not whitelist Fee-on-transfer or rebasing tokens,
     * as the Silo is not compatible with these tokens.
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
        uint64 optimalPercentDepositedBdv,
        Implementation memory oracleImplementation
    ) external payable fundsSafu noNetFlow noSupplyChange {
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
            optimalPercentDepositedBdv,
            oracleImplementation
        );
    }

    /**
     * @notice Adds a token to the Silo Whitelist with an external implementation.
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param encodeType The encode type that should be used to encode the BDV function call. See {LibTokenSilo.beanDenominatedValue}.
     * @param oracleImplementation The implementation of the oracle that should be used to fetch the token price.
     * @param gaugePointImplementation The implementation of the gauge point function that should be used to calculate the gauge points.
     * @param liquidityWeightImplementation The implementation of the liquidity weight function that should be used to calculate the liquidity weight.
     * @dev If the implementation addresses are 0, then beanstalk calls the selector on itself.
     * See {LibWhitelist.whitelistTokenWithExternalImplementation} for more info on implementation.
     * The selector MUST be a view function that returns an uint256 for all implementation.
     * The oracleImplementation selector should take:
     *  - `lookback` parameter
     *  (foo(uint256)).
     * The gaugePointImplementation selector should take:
     *  - current gauge points,
     *  - optimal deposited bdv,
     *  - percent depositedbdv
     * (foo(uint256, uint256, uint256)).
     * The liquidityWeightImplementation selector should take no parameters.
     * (foo()).
     */
    function whitelistTokenWithExternalImplementation(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        Implementation memory oracleImplementation,
        Implementation memory gaugePointImplementation,
        Implementation memory liquidityWeightImplementation
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistTokenWithExternalImplementation(
            token,
            selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            encodeType,
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplementation,
            gaugePointImplementation,
            liquidityWeightImplementation
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
    ) external payable fundsSafu noNetFlow noSupplyChange {
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
    ) external payable fundsSafu noNetFlow noSupplyChange {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateGaugeForToken(
            token,
            gaugePointSelector,
            liquidityWeightSelector,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @notice Updates the Oracle Implementation for a given Token.
     */
    function updateOracleImplementationForToken(
        address token,
        Implementation memory impl
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateOracleImplementationForToken(token, impl);
    }

    /**
     * @notice Updates the Liquidity Weight Implementation for a given Token.
     */
    function updateLiqudityWeightImplementationForToken(
        address token,
        Implementation memory impl
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateLiqudityWeightImplementationForToken(token, impl);
    }

    /**
     * @notice Updates the Gauge Point Implementation for a given Token.
     */
    function updateGaugePointImplementationForToken(
        address token,
        Implementation memory impl
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateGaugePointImplementationForToken(token, impl);
    }

    function updateSeedGaugeSettings(SeedGaugeSettings memory updatedSeedGaugeSettings) external {
        LibDiamond.enforceIsOwnerOrContract();
        s.sys.seedGaugeSettings = updatedSeedGaugeSettings;
        emit UpdatedSeedGaugeSettings(updatedSeedGaugeSettings);
    }
}
