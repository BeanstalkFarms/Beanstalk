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

/**
 * @title LibGauge
 * @author Brean
 * @notice LibGauge handles functionality related to the seed gauge system.
 */
library LibGauge {
    using SafeCast for uint256;
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    uint256 internal constant BDV_PRECISION = 1e6;
    uint256 internal constant GP_PRECISION = 1e18;

    // max and min are the ranges that the beanToMaxLpGpPerBDVRatioScaled can output.
    uint256 internal constant MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO = 100e18;
    uint256 internal constant MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO = 50e18;
    uint256 internal constant BEAN_MAX_LP_GP_RATIO_RANGE =
        MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO - MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO;

    // the maximum value of beanToMaxLpGpPerBDVRatio.
    uint256 internal constant ONE_HUNDRED_PERCENT = 100e18;

    // 24 * 30 * 6
    uint256 internal constant TARGET_SEASONS_TO_CATCHUP = 4320;
    uint256 internal constant STALK_BDV_PRECISION = 1e4;

    /**
     * @notice Emitted when the AverageGrownStalkPerBDVPerSeason Updates.
     */
    event UpdateStalkPerBdvPerSeason(uint256 newStalkPerBdvPerSeason);

    struct LpGaugePointData {
        address lpToken;
        uint256 gpPerBDV;
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
     * @dev updates the GaugePoints for LP assets (if applicable)
     * and the distribution of grown Stalk to silo assets.
     *
     * If the price of bean/eth cannot be computed,
     * skip the gauge system, given that
     * the liquidity cannot be calculated.
     */
    function stepGauge() external {
        if (LibAppStorage.diamondStorage().usdTokenPrice[C.BEAN_ETH_WELL] == 0) return;
        (
            uint256 maxLpGpPerBDV,
            LpGaugePointData[] memory lpGpData,
            uint256 totalGaugePoints,
            uint256 totalLPBdv
        ) = updateGaugePoints();
        updateGrownStalkEarnedPerSeason(maxLpGpPerBDV, lpGpData, totalGaugePoints, totalLPBdv);
    }

    /**
     * @notice evaluate the gauge points of each LP asset.
     */
    function updateGaugePoints()
        internal
        returns (
            uint256 maxLpGpPerBDV,
            LpGaugePointData[] memory lpGpData,
            uint256 totalGaugePoints,
            uint256 totalLPBdv
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory LPSiloTokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        lpGpData = new LpGaugePointData[](LPSiloTokens.length);

        // if there is only one pool, there is no need to update the gauge points.
        if (LPSiloTokens.length == 1) {
            uint256 gaugePoints = s.ss[LPSiloTokens[0]].gaugePoints;
            lpGpData[0].gpPerBDV = gaugePoints.mul(BDV_PRECISION).div(
                s.siloBalances[LPSiloTokens[0]].depositedBdv
            );
            return (
                lpGpData[0].gpPerBDV,
                lpGpData,
                gaugePoints,
                s.siloBalances[LPSiloTokens[0]].depositedBdv
            );
        }

        // summate total deposited BDV across all whitelisted LP tokens.
        for (uint256 i; i < LPSiloTokens.length; ++i) {
            totalLPBdv = totalLPBdv.add(s.siloBalances[LPSiloTokens[i]].depositedBdv);
        }

        // if nothing has been deposited, skip gauge point update.
        if (totalLPBdv == 0) return (maxLpGpPerBDV, lpGpData, totalGaugePoints, totalLPBdv);

        // calculate and update the gauge points for each LP.
        for (uint256 i; i < LPSiloTokens.length; ++i) {
            Storage.SiloSettings storage ss = s.ss[LPSiloTokens[i]];

            uint256 depositedBdv = s.siloBalances[LPSiloTokens[i]].depositedBdv;

            // 1e6 = 1%
            uint256 percentDepositedBdv = depositedBdv.mul(100e6).div(totalLPBdv);

            // gets the gauge points of token from GaugePointFacet.
            uint256 newGaugePoints = calcGaugePoints(
                ss.gpSelector,
                ss.gaugePoints,
                ss.optimalPercentDepositedBdv,
                percentDepositedBdv
            );

            // increment totalGaugePoints and calculate the gaugePoints per BDV:
            totalGaugePoints = totalGaugePoints.add(newGaugePoints);
            LpGaugePointData memory _lpGpData;
            _lpGpData.lpToken = LPSiloTokens[i];

            // gauge points has 18 decimal precision (GP_PRECISION = 1%)
            // deposited BDV has 6 decimal precision (1e6 = 1 unit of BDV)
            uint256 gpPerBDV = newGaugePoints.mul(BDV_PRECISION).div(depositedBdv);

            // gpPerBDV has 6 decimal precision.
            if (gpPerBDV > maxLpGpPerBDV) maxLpGpPerBDV = gpPerBDV;
            _lpGpData.gpPerBDV = gpPerBDV;
            lpGpData[i] = _lpGpData;

            ss.gaugePoints = newGaugePoints.toUint128();
            emit GaugePointChange(s.season.current, LPSiloTokens[i], ss.gaugePoints);
        }
    }

    /**
     * @notice calculates the new gauge points for the given token.
     * @dev function calls the selector of the token's gauge point function.
     * See {GaugePointFacet.defaultGaugePointFunction()}
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
     */
    function updateGrownStalkEarnedPerSeason(
        uint256 maxLpGpPerBDV,
        LpGaugePointData[] memory lpGpData,
        uint256 totalGaugePoints,
        uint256 totalLPBdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 beanDepositedBdv = s.siloBalances[C.BEAN].depositedBdv;
        uint256 totalBdv = totalLPBdv.add(beanDepositedBdv);

        // if nothing has been deposited, skip grown stalk update.
        if (totalBdv == 0) return;

        // calculate the ratio between the bean and the max LP gauge points per BDV.
        // 6 decimal precision
        uint256 beanToMaxLpGpPerBDVRatio = getBeanToMaxLpGpPerBDVRatioScaled(
            s.seedGauge.beanToMaxLpGpPerBDVRatio
        );
        // get the GaugePoints and GPperBDV for bean
        // beanGpPerBDV has 6 decimal precision, beanToMaxLpGpPerBDVRatio has 18.
        uint256 beanGpPerBDV = maxLpGpPerBDV.mul(beanToMaxLpGpPerBDVRatio).div(100e18);

        totalGaugePoints = totalGaugePoints.add(
            beanGpPerBDV.mul(beanDepositedBdv).div(BDV_PRECISION)
        );

        // check if one week elapsed since the last seedGauge update.
        // if so, update the average grown stalk per BDV per Season.
        // safemath not needed
        if (s.season.current - s.seedGauge.lastSeedGaugeUpdate >= 168) {
            updateStalkPerBdvPerSeason();
        }
        // calculate grown stalk issued this season and GrownStalk Per GaugePoint.
        uint256 newGrownStalk = uint256(s.seedGauge.averageGrownStalkPerBdvPerSeason)
            .mul(totalBdv)
            .div(BDV_PRECISION);

        // gauge points has 18 decimal precision.
        uint256 newGrownStalkPerGp = newGrownStalk.mul(GP_PRECISION).div(totalGaugePoints);

        // update stalkPerBDVPerSeason for bean.
        issueGrownStalkPerBDV(C.BEAN, newGrownStalkPerGp, beanGpPerBDV);

        // update stalkPerBdvPerSeason for LP
        // if there is only one pool, then no need to read gauge points.
        if (lpGpData.length == 1) {
            issueGrownStalkPerBDV(lpGpData[0].lpToken, newGrownStalkPerGp, lpGpData[0].gpPerBDV);
        } else {
            for (uint256 i; i < lpGpData.length; i++) {
                issueGrownStalkPerBDV(
                    lpGpData[i].lpToken,
                    newGrownStalkPerGp,
                    lpGpData[i].gpPerBDV
                );
            }
        }
    }

    /**
     * @notice issues the grown stalk per BDV for the given token.
     * @param token the token to issue the grown stalk for.
     * @param grownStalkPerGp the number of GrownStalk Per Gauge Point.
     * @param gpPerBDV the amount of GaugePoints per BDV the token has.
     */
    function issueGrownStalkPerBDV(
        address token,
        uint256 grownStalkPerGp,
        uint256 gpPerBDV
    ) internal {
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(
            token,
            grownStalkPerGp.mul(gpPerBDV).div(GP_PRECISION).toUint32()
        );
    }

    /**
     * @notice updates the updateStalkPerBdvPerSeason in the seed gauge.
     * @dev anyone can call this function to update. Currently, the function
     * updates the targetGrownStalkPerBdvPerSeason such that it will take 6 months
     * for the average new depositer to catch up to the average grown stalk per BDV.
     *
     * The expectation is that actors will call this function on their own as it benefits them.
     * Newer depositers will call it if the value increases to catch up to the average faster,
     * Older depositers will call it if the value decreases to slow down their rate of dilution.
     */
    function updateStalkPerBdvPerSeason() public {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // will overflow if the average grown stalk per BDV exceeds 1.4e36,
        // which is highly improbable assuming consistent new deposits.
        // thus, safeCast was determined is to be unnecessary.
        s.seedGauge.averageGrownStalkPerBdvPerSeason = uint128(
            getAverageGrownStalkPerBdv().mul(BDV_PRECISION).div(TARGET_SEASONS_TO_CATCHUP)
        );
        s.seedGauge.lastSeedGaugeUpdate = s.season.current;
        emit UpdateStalkPerBdvPerSeason(s.seedGauge.averageGrownStalkPerBdvPerSeason);
    }

    /**
     * @notice returns the total BDV in beanstalk.
     * @dev the total BDV may differ from the instaneous BDV,
     * as BDV is asyncronous.
     */
    function getTotalBdv() internal view returns (uint256 totalBdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory whitelistedSiloTokens = LibWhitelistedTokens.getWhitelistedTokens();
        for (uint256 i; i < whitelistedSiloTokens.length; ++i) {
            totalBdv = totalBdv.add(s.siloBalances[whitelistedSiloTokens[i]].depositedBdv);
        }
    }

    /**
     * @notice returns the average grown stalk per BDV .
     */
    function getAverageGrownStalkPerBdv() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalBdv = getTotalBdv();
        if (totalBdv == 0) return 0;
        return s.s.stalk.div(totalBdv).sub(STALK_BDV_PRECISION);
    }

    /**
     * @notice returns the ratio between the bean and
     * the max LP gauge points per BDV.
     * @dev s.seedGauge.beanToMaxLpGpPerBDVRatio is a number between 0 and 100e18,
     * where f(100e18) = MIN_BEAN_MAX_LPGP_RATIO and f(0) = MAX_BEAN_MAX_LPGP_RATIO.
     */
    function getBeanToMaxLpGpPerBDVRatioScaled(
        uint256 beanToMaxLpGpPerBDVRatio
    ) internal pure returns (uint256) {
        return
            beanToMaxLpGpPerBDVRatio.mul(BEAN_MAX_LP_GP_RATIO_RANGE).div(ONE_HUNDRED_PERCENT).add(
                MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO
            );
    }
}
