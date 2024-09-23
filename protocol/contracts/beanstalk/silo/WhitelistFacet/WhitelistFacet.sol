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
import {EvaluationParameters} from "contracts/beanstalk/storage/System.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";

/**
 * @author Publius
 * @title Whitelist Facet
 * @notice Manages the Silo Whitelist including Adding to, Updating
 * and Removing from the Silo Whitelist
 **/
contract WhitelistFacet is Invariable, WhitelistedTokens, ReentrancyGuard {
    /**
     * @notice emitted when {EvaluationParameters} is updated.
     */
    event UpdatedEvaluationParameters(EvaluationParameters);

    /**
     * @notice Removes a token from the Silo Whitelist.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function dewhitelistToken(
        address token
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.dewhitelistToken(token);
    }

    /**
     * @notice Adds a token to the Silo Whitelist.
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param encodeType The encode type that should be used to encode the BDV function call. See {LibTokenSilo.beanDenominatedValue}.
     * @param gaugePoints The initial gauge points for the token.
     * @param optimalPercentDepositedBdv The optimal percent of deposited BDV for the token.
     * @param oracleImplementation The implementation of the oracle that should be used to fetch the token price.
     * @param gaugePointImplementation The implementation of the gauge point function that should be used to calculate the gauge points.
     * @param liquidityWeightImplementation The implementation of the liquidity weight function that should be used to calculate the liquidity weight.
     *
     * @dev If the implementation addresses are 0, then beanstalk calls the selector on itself.
     * See {LibWhitelist.whitelistTokenWithExternalImplementation} for more info on implementation.
     * The selector MUST be a view function that returns an uint256 for all implementation.
     * The oracleImplementation selector should take:
     *  - `lookback` parameter
     *  - `decimals` parameter
     *  (foo(uint256)).
     * The gaugePointImplementation selector should take:
     *  - current gauge points,
     *  - optimal deposited bdv,
     *  - percent depositedbdv
     *  - percent bytes
     * (foo(uint256, uint256, uint256, bytes)).
     * The liquidityWeightImplementation selector should take:
     * (foo(bytes)).
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint48 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        Implementation memory oracleImplementation,
        Implementation memory gaugePointImplementation,
        Implementation memory liquidityWeightImplementation
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
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
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(token, stalkEarnedPerSeason);
    }

    /**
     * @notice Updates gauge settings for token.
     * @dev {LibWhitelistedTokens} must be updated to include the new token.
     * Assumes the gaugePoint and LiquidityWeight implementations are functions
     * implemented in the Beanstalk contract.
     */
    function updateGaugeForToken(
        address token,
        uint64 optimalPercentDepositedBdv,
        Implementation memory gpImplementation,
        Implementation memory lwImplementation
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateGaugeForToken(
            token,
            optimalPercentDepositedBdv,
            gpImplementation,
            lwImplementation
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

    function updateSeedGaugeSettings(
        EvaluationParameters memory updatedSeedGaugeSettings
    ) external {
        LibDiamond.enforceIsOwnerOrContract();
        s.sys.evaluationParameters = updatedSeedGaugeSettings;
        emit UpdatedEvaluationParameters(updatedSeedGaugeSettings);
    }

    function getOracleImplementationForToken(
        address token
    ) external view returns (Implementation memory) {
        return s.sys.oracleImplementation[token];
    }

    function getGaugePointImplementationForToken(
        address token
    ) external view returns (Implementation memory) {
        return s.sys.silo.assetSettings[token].gaugePointImplementation;
    }

    function getLiquidityWeightImplementationForToken(
        address token
    ) external view returns (Implementation memory) {
        return s.sys.silo.assetSettings[token].liquidityWeightImplementation;
    }
}
