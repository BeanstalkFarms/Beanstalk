/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "../../C.sol";
import {LibAppStorage} from "../LibAppStorage.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {AssetSettings} from "contracts/beanstalk/storage/System.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibWell, IWell} from "contracts/libraries/Well/LibWell.sol";
import {IChainlinkAggregator} from "contracts/interfaces/chainlink/IChainlinkAggregator.sol";
import {LibRedundantMath32} from "contracts/libraries/LibRedundantMath32.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IERC20Decimals} from "contracts/libraries/Oracle/LibUsdOracle.sol";

/**
 * @title LibWhitelist
 * @author Publius
 * @notice Handles adding and removing ERC-20 tokens from the Silo Whitelist.
 */
library LibWhitelist {
    using LibRedundantMath32 for uint32;
    using SafeCast for int32;

    /**
     * @notice Emitted when a token is added to the Silo Whitelist.
     * @param token ERC-20 token being added to the Silo Whitelist.
     * @param selector The function selector that returns the BDV of a given token.
     * @param stalkEarnedPerSeason The Stalk per BDV per Season received from depositing `token`.
     * @param stalkIssuedPerBdv The Stalk per BDV given from depositing `token`.
     * @param gaugePoints The gauge points of the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    );

    /**
     * @notice Emitted when the oracle implementation for a token is updated.
     */
    event UpdatedOracleImplementationForToken(
        address indexed token,
        Implementation oracleImplementation
    );

    /**
     * @notice Emitted when the gauge point implementation for a token is updated.
     */
    event UpdatedGaugePointImplementationForToken(
        address indexed token,
        Implementation gaugePointImplementation
    );

    /**
     * @notice Emitted when the liquidity weight implementation for a token is updated.
     */
    event UpdatedLiquidityWeightImplementationForToken(
        address indexed token,
        Implementation liquidityWeightImplementation
    );

    /**
     * @notice Emitted when the gauge settings are updated.
     * @param token Token that is being updated.
     * @param optimalPercentDepositedBdv The new optimal Percent deposited BDV
     */
    event UpdatedOptimalPercentDepositedBdvForToken(
        address indexed token,
        uint64 optimalPercentDepositedBdv
    );

    /**
     * @notice Emitted when the stalk per bdv per season for a Silo token is updated.
     * @param token ERC-20 token being updated in the Silo Whitelist.
     * @param stalkEarnedPerSeason New stalk per bdv per season value for this token.
     * @param season The season that the new stalk per bdv per season value becomes active (The current season).
     */
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
        uint32 season
    );

    /**
     * @notice Emitted when a token is removed from the Silo Whitelist.
     * @param token ERC-20 token being removed from the Silo Whitelist.
     */
    event DewhitelistToken(address indexed token);

    /**
     * @dev Adds an ERC-20 token to the Silo Whitelist.
     * Assumes future tokens will be well pool tokens.
     * Assumes if the gpImplementation and lwImplementation targets are not set,
     * that they are implemented in this diamond.
     * Oracle Implementations may or may not be implemented, depending on the token.
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
        Implementation memory gpImplementation,
        Implementation memory lwImplementation
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // verify the gaugePoint and liquidityWeight selector.
        verifyGaugePointImplementation(gpImplementation);
        verifyLiquidityWeightImplementation(lwImplementation);

        // add whitelist status
        verifyWhitelistStatus(token, selector, stalkIssuedPerBdv);

        // If an LP token, initialize oracle storage variables and set Oracle Implementation:
        if (token != address(s.sys.tokens.bean) && !LibUnripe.isUnripe(token)) {
            s.sys.usdTokenPrice[token] = 1;
            s.sys.twaReserves[token].reserve0 = 1;
            s.sys.twaReserves[token].reserve1 = 1;

            // the Oracle should return the price for the non-bean asset in USD
            address nonBeanToken = address(LibWell.getNonBeanTokenFromWell(token));
            verifyOracleImplementation(nonBeanToken, oracleImplementation);
            s.sys.oracleImplementation[nonBeanToken] = oracleImplementation;
            emit UpdatedOracleImplementationForToken(nonBeanToken, oracleImplementation);
        }

        require(
            s.sys.silo.assetSettings[token].milestoneSeason == 0,
            "Whitelist: Token already whitelisted"
        );
        // beanstalk requires all whitelisted assets to have a minimum stalkEarnedPerSeeason
        // of 1 (due to the germination update). set stalkEarnedPerSeason to 1 to prevent revert.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;
        s.sys.silo.assetSettings[token].selector = selector;
        s.sys.silo.assetSettings[token].stalkEarnedPerSeason = stalkEarnedPerSeason;
        s.sys.silo.assetSettings[token].stalkIssuedPerBdv = stalkIssuedPerBdv;
        s.sys.silo.assetSettings[token].milestoneSeason = uint32(s.sys.season.current);
        s.sys.silo.assetSettings[token].encodeType = encodeType;
        s.sys.silo.assetSettings[token].gaugePointImplementation.selector = bytes4(0);
        s.sys.silo.assetSettings[token].liquidityWeightImplementation.selector = bytes4(0);
        s.sys.silo.assetSettings[token].gaugePoints = gaugePoints;
        s.sys.silo.assetSettings[token].optimalPercentDepositedBdv = optimalPercentDepositedBdv;
        s.sys.silo.assetSettings[token].gaugePointImplementation = gpImplementation;
        s.sys.silo.assetSettings[token].liquidityWeightImplementation = lwImplementation;

        emit WhitelistToken(
            token,
            selector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePoints,
            optimalPercentDepositedBdv
        );

        emit UpdatedGaugePointImplementationForToken(token, gpImplementation);
        emit UpdatedLiquidityWeightImplementationForToken(token, lwImplementation);
    }

    /**
     * @notice Updates gauge settings for token.
     * @dev {LibWhitelistedTokens} must be updated to include the new token.
     */
    function updateGaugeForToken(
        address token,
        uint64 optimalPercentDepositedBdv,
        Implementation memory gpImplementation,
        Implementation memory lwImplementation
    ) internal {
        updateGaugePointImplementationForToken(token, gpImplementation);
        updateLiqudityWeightImplementationForToken(token, lwImplementation);
        updateOptimalPercentDepositedBdvForToken(token, optimalPercentDepositedBdv);
    }

    /**
     * @dev Updates the Stalk per BDV per Season for a token.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(s.sys.silo.assetSettings[token].milestoneSeason != 0, "Token not whitelisted");

        // beanstalk requires a min. stalkEarnedPerSeason of 1.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;

        // update milestone stem and season.
        s.sys.silo.assetSettings[token].milestoneStem = LibTokenSilo.stemTipForToken(token);
        s.sys.silo.assetSettings[token].milestoneSeason = s.sys.season.current;

        // stalkEarnedPerSeason is set to int32 before casting down.
        s.sys.silo.assetSettings[token].deltaStalkEarnedPerSeason = (int32(stalkEarnedPerSeason) -
            int32(s.sys.silo.assetSettings[token].stalkEarnedPerSeason)).toInt24();
        s.sys.silo.assetSettings[token].stalkEarnedPerSeason = stalkEarnedPerSeason;

        emit UpdatedStalkPerBdvPerSeason(token, stalkEarnedPerSeason, s.sys.season.current);
    }

    /**
     * @notice Updates optimalPercentDepositedBdv token.
     * @dev {LibWhitelistedTokens} must be updated to include the new token.
     */
    function updateOptimalPercentDepositedBdvForToken(
        address token,
        uint64 optimalPercentDepositedBdv
    ) internal {
        AssetSettings storage ss = LibAppStorage.diamondStorage().sys.silo.assetSettings[token];
        ss.optimalPercentDepositedBdv = optimalPercentDepositedBdv;
        emit UpdatedOptimalPercentDepositedBdvForToken(token, optimalPercentDepositedBdv);
    }

    /**
     * @notice updates the oracle implementation for a token.
     */
    function updateOracleImplementationForToken(
        address token,
        Implementation memory oracleImplementation
    ) internal {
        // check that new implementation is valid.
        verifyOracleImplementation(token, oracleImplementation);

        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.oracleImplementation[token] = oracleImplementation;

        emit UpdatedOracleImplementationForToken(token, oracleImplementation);
    }

    /**
     * @notice updates the gauge point implementation for a token.
     */
    function updateGaugePointImplementationForToken(
        address token,
        Implementation memory gpImplementation
    ) internal {
        AssetSettings storage ss = LibAppStorage.diamondStorage().sys.silo.assetSettings[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");

        // check that new implementation is valid.
        verifyGaugePointImplementation(gpImplementation);

        ss.gaugePointImplementation = gpImplementation;

        emit UpdatedGaugePointImplementationForToken(token, gpImplementation);
    }

    /**
     * @notice updates the gauge point implementation for a token.
     */
    function updateLiqudityWeightImplementationForToken(
        address token,
        Implementation memory lwImplementation
    ) internal {
        AssetSettings storage ss = LibAppStorage.diamondStorage().sys.silo.assetSettings[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");

        // check that new implementation is valid.
        verifyLiquidityWeightImplementation(lwImplementation);

        ss.liquidityWeightImplementation = lwImplementation;

        emit UpdatedLiquidityWeightImplementationForToken(token, lwImplementation);
    }

    /**
     * @notice Removes an ERC-20 token from the Silo Whitelist.
     *
     */
    function dewhitelistToken(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 tokenStatusIndex = LibWhitelistedTokens.findWhitelistStatusIndex(token);

        // before dewhitelisting, verify that `libWhitelistedTokens` are updated.
        LibWhitelistedTokens.updateWhitelistStatus(
            token,
            false,
            false,
            false,
            s.sys.silo.whitelistStatuses[tokenStatusIndex].isSoppable // if token was soppable, it should remain so, so that previous sops can be claimed.
        );

        // set the stalkEarnedPerSeason to 1 and update milestone stem.
        // stalkEarnedPerSeason requires a min value of 1.
        updateStalkPerBdvPerSeasonForToken(token, 1);

        // delete the selector and encodeType.
        delete s.sys.silo.assetSettings[token].selector;
        delete s.sys.silo.assetSettings[token].encodeType;

        // delete gaugePoints, gaugePointSelector, liquidityWeightSelector, and optimalPercentDepositedBdv.
        delete s.sys.silo.assetSettings[token].gaugePoints;
        delete s.sys.silo.assetSettings[token].gaugePointImplementation;
        delete s.sys.silo.assetSettings[token].liquidityWeightImplementation;
        delete s.sys.silo.assetSettings[token].optimalPercentDepositedBdv;

        // delete implementations:
        delete s.sys.silo.assetSettings[token].gaugePointImplementation;
        delete s.sys.silo.assetSettings[token].liquidityWeightImplementation;

        emit DewhitelistToken(token);
    }

    /**
     * @notice Verifies whether the bdv selector is valid.
     */
    function verifyBDVselector(address token, bytes1 encodeType, bytes4 selector) internal view {
        (bool success, ) = address(this).staticcall(
            LibTokenSilo.encodeBdvFunction(token, encodeType, selector, 0)
        );
        require(success, "Whitelist: Invalid BDV selector");
    }

    /**
     * @notice Verifies whether a gaugePointSelector at an external contract
     * is valid for the gauge system.
     */
    function verifyOracleImplementation(
        address token,
        Implementation memory oracleImplementation
    ) internal {
        bool success;
        bytes memory returnData;
        // if the encode type is 0x01, verify using the chainlink implementation.
        if (oracleImplementation.encodeType == bytes1(0x01)) {
            (success, returnData) = oracleImplementation.target.staticcall(
                abi.encodeWithSelector(IChainlinkAggregator.decimals.selector)
            );
        } else if (oracleImplementation.encodeType == bytes1(0x02)) {
            // 0x0dfe1681 == token0() for uniswap pools.
            (success, returnData) = oracleImplementation.target.staticcall(
                abi.encodeWithSelector(0x0dfe1681)
            );
        } else {
            // external oracles must have a target address
            require(oracleImplementation.target != address(0), "Whitelist: Invalid Target Address");

            // verify you passed in a callable oracle selector
            (success, returnData) = oracleImplementation.target.call(
                abi.encodeWithSelector(
                    oracleImplementation.selector,
                    IERC20Decimals(token).decimals(),
                    0,
                    oracleImplementation.data
                )
            );
        }
        require(success && returnData.length > 0, "Whitelist: Invalid Oracle Implementation");
    }

    /**
     * @notice Verifies whether a gaugePointSelector at an external contract
     * is valid for the gauge system.
     */
    function verifyGaugePointImplementation(Implementation memory gpImplementation) internal view {
        // if the target is not set, assume the gaugePoint implementation is in this diamond.
        address target = gpImplementation.target == address(0)
            ? address(this)
            : gpImplementation.target;
        // verify you passed in a callable gaugePoint selector
        (bool success, bytes memory returnData) = target.staticcall(
            abi.encodeWithSelector(gpImplementation.selector, 0, 0, 0, gpImplementation.data)
        );
        require(success && returnData.length > 0, "Whitelist: Invalid GaugePoint Implementation");
    }

    /**
     * @notice Verifies whether liquidityWeight selector at an external contract
     * is valid for the gauge system.
     */
    function verifyLiquidityWeightImplementation(Implementation memory lw) internal view {
        // if the target is not set, assume the liquidity weight implementation is in this diamond.
        address target = lw.target == address(0) ? address(this) : lw.target;
        // verify you passed in a callable liquidityWeight selector
        (bool success, bytes memory returnData) = target.staticcall(
            abi.encodeWithSelector(lw.selector, lw.data)
        );
        require(
            success && returnData.length > 0,
            "Whitelist: Invalid LiquidityWeight Implementation"
        );
    }

    /**
     * @notice verifies whether a token is not whitelisted.
     * @dev if the token has been previously whitelisted,
     * return the current stalk issued per bdv.
     */
    function verifyWhitelistStatus(
        address token,
        bytes4 selector,
        uint48 stalkIssuedPerBdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (bool isWhitelisted, bool previouslyWhitelisted) = LibWhitelistedTokens.checkWhitelisted(
            token
        );
        require(isWhitelisted == false, "Whitelist: Token already whitelisted");

        // add whitelist status. If previously whitelisted, update the status rather than appending.
        if (previouslyWhitelisted) {
            LibWhitelistedTokens.updateWhitelistStatus(
                token,
                true, // Whitelisted by default.
                token != address(s.sys.tokens.bean) && !LibUnripe.isUnripe(token), // Assumes tokens that are not Unripe and not Bean are LP tokens.
                selector == LibWell.WELL_BDV_SELECTOR,
                selector == LibWell.WELL_BDV_SELECTOR // Assumes wells are soppable if selector is WELL_BDV_SELECTOR
            );
        } else {
            // assumes new tokens are well pool tokens.
            LibWhitelistedTokens.addWhitelistStatus(
                token,
                true, // Whitelisted by default.
                token != address(s.sys.tokens.bean) && !LibUnripe.isUnripe(token), // Assumes tokens that are not Unripe and not Bean are LP tokens.
                selector == LibWell.WELL_BDV_SELECTOR,
                selector == LibWell.WELL_BDV_SELECTOR // Assumes wells are soppable if selector is WELL_BDV_SELECTOR
            );
        }

        // if the token has previously been whitelisted, the stalkIssuedPerBdv
        // cannot be updated, as previous deposits would have been made with the
        // previous value.
        if (previouslyWhitelisted) {
            require(
                s.sys.silo.assetSettings[token].stalkIssuedPerBdv == stalkIssuedPerBdv,
                "Whitelist: Cannot update stalkIssuedPerBdv"
            );
        }
    }
}
