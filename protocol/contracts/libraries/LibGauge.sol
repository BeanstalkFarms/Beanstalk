/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, AppStorage, Storage} from "./LibAppStorage.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {C} from "../C.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";

/**
 * @title LibGauge
 * @author Brean, Brendan
 * @notice LibGauge handles functionality related to the seed gauge system.
 */
library LibGauge {
    using SafeCast for uint256;
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    uint256 internal constant BDV_PRECISION = 1e6;
    uint256 internal constant GP_PRECISION = 1e18;

    // Max and min are the ranges that the beanToMaxLpGpPerBdvRatioScaled can output.
    uint256 internal constant MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO = 100e18;
    uint256 internal constant MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO = 50e18;
    uint256 internal constant BEAN_MAX_LP_GP_RATIO_RANGE =
        MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO - MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO;

    // The maximum value of beanToMaxLpGpPerBdvRatio.
    uint256 internal constant ONE_HUNDRED_PERCENT = 100e18;

    // 24 * 30 * 6
    uint256 internal constant TARGET_SEASONS_TO_CATCHUP = 4320;
    uint256 internal constant STALK_BDV_PRECISION = 1e4;

    /**
     * @notice Emitted when the AverageGrownStalkPerBdvPerSeason Updates.
     */
    event UpdateAverageStalkPerBdvPerSeason(uint256 newStalkPerBdvPerSeason);

    struct LpGaugePointData {
        address lpToken;
        uint256 gpPerBdv;
    }
    /**
     * @notice Emitted when the gaugePoints for an LP silo token changes.
     * @param season The current Season
     * @param token The LP silo token whose gaugePoints was updated.
     * @param gaugePoints The new gaugePoints for the LP silo token.
     */
    event GaugePointChange(uint256 indexed season, address indexed token, uint256 gaugePoints);

    /**
     * @notice Updates the seed gauge system.
     * @dev Updates the GaugePoints for LP assets (if applicable)
     * and the distribution of grown Stalk to silo assets.
     *
     * If any of the LP price oracle failed,
     * then the gauge system should be skipped, as a valid
     * usd liquidity value cannot be computed.
     */
    function stepGauge() external {
        (
            uint256 maxLpGpPerBdv,
            LpGaugePointData[] memory lpGpData,
            uint256 totalGaugePoints,
            uint256 totalLpBdv
        ) = updateGaugePoints();

        // If totalLpBdv is max, it means that the gauge points has failed,
        // and the gauge system should be skipped.
        if (totalLpBdv == type(uint256).max) return;

        updateGrownStalkEarnedPerSeason(maxLpGpPerBdv, lpGpData, totalGaugePoints, totalLpBdv);
    }

    /**
     * @notice Evaluate the gauge points of each LP asset.
     * @dev `totalLpBdv` is returned as type(uint256).max when an Oracle failure occurs.
     */
    function updateGaugePoints()
        internal
        returns (
            uint256 maxLpGpPerBdv,
            LpGaugePointData[] memory lpGpData,
            uint256 totalGaugePoints,
            uint256 totalLpBdv
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory whitelistedLpTokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        lpGpData = new LpGaugePointData[](whitelistedLpTokens.length);
        // If there is only one pool, there is no need to update the gauge points.
        if (whitelistedLpTokens.length == 1) {
            // If the usd price oracle failed, skip gauge point update.
            // Assumes that only Wells use USD price oracles.
            if (
                LibWell.isWell(whitelistedLpTokens[0]) &&
                s.usdTokenPrice[whitelistedLpTokens[0]] == 0
            ) {
                return (maxLpGpPerBdv, lpGpData, totalGaugePoints, type(uint256).max);
            }
            uint256 gaugePoints = s.ss[whitelistedLpTokens[0]].gaugePoints;

            lpGpData[0].lpToken = whitelistedLpTokens[0];
            // If nothing has been deposited, skip gauge point update.
            uint128 depositedBdv = s.siloBalances[whitelistedLpTokens[0]].depositedBdv;
            if (depositedBdv == 0)
                return (maxLpGpPerBdv, lpGpData, totalGaugePoints, type(uint256).max);
            lpGpData[0].gpPerBdv = gaugePoints.mul(BDV_PRECISION).div(
                s.siloBalances[whitelistedLpTokens[0]].depositedBdv
            );
            return (
                lpGpData[0].gpPerBdv,
                lpGpData,
                gaugePoints,
                s.siloBalances[whitelistedLpTokens[0]].depositedBdv
            );
        }

        // Summate total deposited BDV across all whitelisted LP tokens.
        for (uint256 i; i < whitelistedLpTokens.length; ++i) {
            // Assumes that only Wells use USD price oracles.
            if (
                LibWell.isWell(whitelistedLpTokens[i]) &&
                s.usdTokenPrice[whitelistedLpTokens[i]] == 0
            ) {
                return (maxLpGpPerBdv, lpGpData, totalGaugePoints, type(uint256).max);
            }
            totalLpBdv = totalLpBdv.add(s.siloBalances[whitelistedLpTokens[i]].depositedBdv);
        }

        // If nothing has been deposited, skip gauge point update.
        if (totalLpBdv == 0) return (maxLpGpPerBdv, lpGpData, totalGaugePoints, type(uint256).max);

        // Calculate and update the gauge points for each LP.
        for (uint256 i; i < whitelistedLpTokens.length; ++i) {
            Storage.SiloSettings storage ss = s.ss[whitelistedLpTokens[i]];

            uint256 depositedBdv = s.siloBalances[whitelistedLpTokens[i]].depositedBdv;

            // 1e6 = 1%
            uint256 percentDepositedBdv = depositedBdv.mul(100e6).div(totalLpBdv);

            // Calculate the new gauge points of the token.
            uint256 newGaugePoints = calcGaugePoints(
                ss.gpSelector,
                ss.gaugePoints,
                ss.optimalPercentDepositedBdv,
                percentDepositedBdv
            );

            // Increment totalGaugePoints and calculate the gaugePoints per BDV:
            totalGaugePoints = totalGaugePoints.add(newGaugePoints);
            LpGaugePointData memory _lpGpData;
            _lpGpData.lpToken = whitelistedLpTokens[i];

            // Gauge points has 18 decimal precision (GP_PRECISION = 1%)
            // Deposited BDV has 6 decimal precision (1e6 = 1 unit of BDV)
            uint256 gpPerBdv = depositedBdv > 0 ? newGaugePoints.mul(BDV_PRECISION).div(depositedBdv) : 0;

            // gpPerBdv has 18 decimal precision.
            if (gpPerBdv > maxLpGpPerBdv) maxLpGpPerBdv = gpPerBdv;
            _lpGpData.gpPerBdv = gpPerBdv;
            lpGpData[i] = _lpGpData;

            ss.gaugePoints = newGaugePoints.toUint128();
            emit GaugePointChange(s.season.current, whitelistedLpTokens[i], ss.gaugePoints);
        }
    }

    /**
     * @notice Calculates the new gauge points for the given token.
     * @dev Function calls the selector of the token's gauge point function.
     * Currently all assets uses the default GaugePoint Function.
     * {GaugePointFacet.defaultGaugePointFunction()}
     */
    function calcGaugePoints(
        bytes4 gpSelector,
        uint256 gaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentDepositedBdv
    ) internal view returns (uint256 newGaugePoints) {
        bytes memory callData = abi.encodeWithSelector(
            gpSelector,
            gaugePoints,
            optimalPercentDepositedBdv,
            percentDepositedBdv
        );
        (bool success, bytes memory data) = address(this).staticcall(callData);
        if (!success) {
            if (data.length == 0) revert();
            assembly {
                revert(add(32, data), mload(data))
            }
        }
        assembly {
            newGaugePoints := mload(add(data, add(0x20, 0)))
        }
    }

    /**
     * @notice Updates the average grown stalk per BDV per Season for whitelisted Beanstalk assets.
     * @dev Called at the end of each Season.
     * The gauge system considers the total BDV of all whitelisted silo tokens, excluding unripe assets.
     */
    function updateGrownStalkEarnedPerSeason(
        uint256 maxLpGpPerBdv,
        LpGaugePointData[] memory lpGpData,
        uint256 totalGaugePoints,
        uint256 totalLpBdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 beanDepositedBdv = s.siloBalances[C.BEAN].depositedBdv;
        uint256 totalGaugeBdv = totalLpBdv.add(beanDepositedBdv);

        // If nothing has been deposited, skip grown stalk update.
        if (totalGaugeBdv == 0) return;

        // Calculate the ratio between the bean and the max LP gauge points per BDV.
        // 18 decimal precision.
        uint256 beanToMaxLpGpPerBdvRatio = getBeanToMaxLpGpPerBdvRatioScaled(
            s.seedGauge.beanToMaxLpGpPerBdvRatio
        );

        // Get the GaugePoints and GPperBDV for bean
        // BeanGpPerBdv and beanToMaxLpGpPerBdvRatio has 18 decimal precision.
        uint256 beanGpPerBdv = maxLpGpPerBdv.mul(beanToMaxLpGpPerBdvRatio).div(100e18);

        totalGaugePoints = totalGaugePoints.add(
            beanGpPerBdv.mul(beanDepositedBdv).div(BDV_PRECISION)
        );

        // update the average grown stalk per BDV per Season.
        // beanstalk must exist for a minimum of the catchup season in order to update the average.
        if (s.season.current > TARGET_SEASONS_TO_CATCHUP) {
            updateAverageStalkPerBdvPerSeason();
        }

        // Calculate grown stalk issued this season and GrownStalk Per GaugePoint.
        uint256 newGrownStalk = uint256(s.seedGauge.averageGrownStalkPerBdvPerSeason)
            .mul(totalGaugeBdv)
            .div(BDV_PRECISION);

        // Gauge points has 18 decimal precision.
        uint256 newGrownStalkPerGp = newGrownStalk.mul(GP_PRECISION).div(totalGaugePoints);

        // Update stalkPerBdvPerSeason for bean.
        issueGrownStalkPerBdv(C.BEAN, newGrownStalkPerGp, beanGpPerBdv);

        // Update stalkPerBdvPerSeason for LP
        // If there is only one pool, then no need to read gauge points.
        if (lpGpData.length == 1) {
            issueGrownStalkPerBdv(lpGpData[0].lpToken, newGrownStalkPerGp, lpGpData[0].gpPerBdv);
        } else {
            for (uint256 i; i < lpGpData.length; i++) {
                issueGrownStalkPerBdv(
                    lpGpData[i].lpToken,
                    newGrownStalkPerGp,
                    lpGpData[i].gpPerBdv
                );
            }
        }
    }

    /**
     * @notice issues the grown stalk per BDV for the given token.
     * @param token the token to issue the grown stalk for.
     * @param grownStalkPerGp the number of GrownStalk Per Gauge Point.
     * @param gpPerBdv the amount of GaugePoints per BDV the token has.
     */
    function issueGrownStalkPerBdv(
        address token,
        uint256 grownStalkPerGp,
        uint256 gpPerBdv
    ) internal {
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(
            token,
            grownStalkPerGp.mul(gpPerBdv).div(GP_PRECISION).toUint32()
        );
    }

    /**
     * @notice Updates the UpdateAverageStalkPerBdvPerSeason in the seed gauge.
     * @dev The function updates the targetGrownStalkPerBdvPerSeason such that 
     * it will take 6 months for the average new depositer to catch up to the current
     * average grown stalk per BDV.
     */
    function updateAverageStalkPerBdvPerSeason() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Will overflow if the average grown stalk per BDV exceeds 1.4e36,
        // which is highly improbable assuming consistent new deposits.
        // Thus, safeCast was determined is to be unnecessary.
        s.seedGauge.averageGrownStalkPerBdvPerSeason = uint128(
            getAverageGrownStalkPerBdv().mul(BDV_PRECISION).div(TARGET_SEASONS_TO_CATCHUP)
        );
        emit UpdateAverageStalkPerBdvPerSeason(s.seedGauge.averageGrownStalkPerBdvPerSeason);
    }

    /**
     * @notice Returns the total BDV in beanstalk.
     * @dev The total BDV may differ from the instaneous BDV,
     * as BDV is asyncronous.
     * Note We get the silo Tokens, not the whitelisted tokens
     * to account for grown stalk from dewhitelisted tokens.
     */
    function getTotalBdv() internal view returns (uint256 totalBdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();
        for (uint256 i; i < siloTokens.length; ++i) {
            totalBdv = totalBdv.add(s.siloBalances[siloTokens[i]].depositedBdv);
        }
    }

    /**
     * @notice Returns the average grown stalk per BDV.
     * @dev `totalBDV` refers to the total BDV deposited in the silo.
     */
    function getAverageGrownStalkPerBdv() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalBdv = getTotalBdv();
        if (totalBdv == 0) return 0;
        return s.s.stalk.div(totalBdv).sub(STALK_BDV_PRECISION);
    }

    /**
     * @notice Returns the ratio between the bean and
     * the max LP gauge points per BDV.
     * @dev s.seedGauge.beanToMaxLpGpPerBdvRatio is a number between 0 and 100e18,
     * where f(0) = MIN_BEAN_MAX_LPGP_RATIO and f(100e18) = MAX_BEAN_MAX_LPGP_RATIO.
     * At the minimum value (0), beans should have half of the
     * largest gauge points per BDV out of the LPs.
     * At the maximum value (100e18), beans should have the same amount of
     * gauge points per BDV as the largest out of the LPs.
     */
    function getBeanToMaxLpGpPerBdvRatioScaled(
        uint256 beanToMaxLpGpPerBdvRatio
    ) internal pure returns (uint256) {
        return
            beanToMaxLpGpPerBdvRatio.mul(BEAN_MAX_LP_GP_RATIO_RANGE).div(ONE_HUNDRED_PERCENT).add(
                MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO
            );
    }
}
