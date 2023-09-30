/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibAppStorage.sol";
import "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import "contracts/libraries/Silo/LibWhitelist.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "../C.sol";

import "hardhat/console.sol";

/**
 * @title LibGauge
 * @author Brean
 * @notice LibGauge handles functionality related to the seed gauge system.
 */
library LibGauge {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    uint256 private constant PRECISION = 1e6;
    uint256 private constant ONE_HUNDRED_PERCENT = 100e6;

    uint256 internal constant MAX_BEAN_MAX_LPGP_RATIO = 100e6;
    uint256 internal constant MIN_BEAN_MAX_LPGP_RATIO = 25e6;
    uint256 internal constant BEAN_MAXLPGP_RANGE = MAX_BEAN_MAX_LPGP_RATIO - MIN_BEAN_MAX_LPGP_RATIO;
    uint256 internal constant BEAN_ETH_OPTIMAL_PERCENT = 100e6;


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
    event GaugePointChange(
        uint256 indexed season,
        address indexed token,
        uint256 gaugePoints
    );

    /**
     * @notice Updates the seed gauge system.
     * @dev updates the GaugePoints for LP assets (if applicable)
     * and the distribution of grown Stalk to silo assets.
     */
    function stepGauge() internal {
        console.log("updateGaugePoints:");
        (
            uint256 maxLpGpPerBDV, 
            LpGaugePointData[] memory lpGpData, 
            uint256 totalGaugePoints,
            uint256 totalLPBdv
        ) =  updateGaugePoints();
        console.log("updateGrownStalkEarnedPerSeason:");
        updateGrownStalkEarnedPerSeason(
            maxLpGpPerBDV,
            lpGpData,
            totalGaugePoints,
            totalLPBdv
        );
    }

    /**
     * @notice re-evaluate the gauge points of each LP asset, then normalize.
     * @dev Gauge points are normalized to 100e6.
     */
    function updateGaugePoints() 
    internal returns (
        uint256 maxLpGpPerBDV, 
        LpGaugePointData[] memory lpGpData, 
        uint256 totalGaugePoints,
        uint256 totalLPBdv
    ) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory LPSiloTokens = LibWhitelistedTokens.getSiloLPTokens();
        lpGpData = new LpGaugePointData[](LPSiloTokens.length);

        // summate total deposited BDV across all whitelisted LP tokens.
        // TODO: add unmigrated
        for (uint256 i; i < LPSiloTokens.length; ++i) {
            totalLPBdv = totalLPBdv.add(s.siloBalances[LPSiloTokens[i]].depositedBdv);
        }
        console.log("totalLPBdv:", totalLPBdv);
        
        // if nothing has been deposited, skip gauge point update.
        if (totalLPBdv == 0) return (
            maxLpGpPerBDV, 
            lpGpData, 
            totalGaugePoints, 
            totalLPBdv
        );

        // if there is only one pool, there is no need to update the gauge points.
        if (LPSiloTokens.length == 1) {
            uint256 gaugePoints = s.ss[LPSiloTokens[0]].gaugePoints;
            lpGpData[0].gpPerBDV = gaugePoints.mul(PRECISION).div(totalLPBdv);
            return (lpGpData[0].gpPerBDV, lpGpData, gaugePoints, totalLPBdv); 
        }

        
        console.log("in loop:");
        // calculate and update the gauge points for each LP.
        for (uint256 i; i < LPSiloTokens.length; ++i) {
            console.log("-------");
            console.log("token:", LPSiloTokens[i]);
            Storage.SiloSettings storage ss = s.ss[LPSiloTokens[i]];
            
            uint256 depositedBdv = s.siloBalances[LPSiloTokens[i]].depositedBdv;
            console.log("depositedBDV:", s.siloBalances[LPSiloTokens[i]].depositedBdv);
            
            // 1e6 = 1%
            uint256 percentOfDepositedBdv = depositedBdv
                .mul(100e6)
                .div(totalLPBdv);

            console.log("percentOfDepositedBdv:", percentOfDepositedBdv);
            console.log("gaugePoints before:", ss.gaugePoints);
            // gets the gauge points of token from GaugePointFacet.
            console.log("gpSelector:");
            console.logBytes4(ss.gpSelector);
            console.log("gaugePoints:", ss.gaugePoints);
            console.log("optimal % LP deposited:", getOptimalPercentLPDepositedBDV(LPSiloTokens[i]));
            console.log("current % deposited BDV:", percentOfDepositedBdv);
            uint256 newGaugePoints = getGaugePoints(
                ss.gpSelector,
                ss.gaugePoints,
                getOptimalPercentLPDepositedBDV(LPSiloTokens[i]),
                percentOfDepositedBdv
            );
            console.log("gaugePoints after:", newGaugePoints);
            
            // increment totalGaugePoints and calculate the gaugePoints per BDV:
            totalGaugePoints = totalGaugePoints.add(newGaugePoints);
            console.log("total Gp:", totalGaugePoints);
            LpGaugePointData memory _lpGpData;
            _lpGpData.lpToken = LPSiloTokens[i];
            console.log(" _lpGpData.lpToken",  _lpGpData.lpToken);

            // gauge points has 1e6 precision (1e6 = 1%)
            // deposited BDV has 1 decimal (1 = 1 )
            uint256 gpPerBDV = uint256(newGaugePoints).mul(PRECISION).div(depositedBdv);
            // gpPerBDV has 6 decimal precision (arbitrary)
            console.log("gpPerBDV", gpPerBDV);
            if (gpPerBDV > maxLpGpPerBDV) maxLpGpPerBDV = gpPerBDV;
            console.log("maxLpGpPerBDV", maxLpGpPerBDV);
            _lpGpData.gpPerBDV = gpPerBDV;
            console.log("_lpGpData.gpPerBDV", _lpGpData.gpPerBDV);
            console.log("i", i);
            console.log("lpGpData length:", lpGpData.length);
            lpGpData[i] = _lpGpData;
            console.log("lpGpData[i] token ", lpGpData[i].lpToken);
            console.log("lpGpData[i] gpPerBdv ", lpGpData[i].gpPerBDV);
            // store gauge points to normalize
            ss.gaugePoints = uint32(newGaugePoints);
            console.log("new ss.gaugePoints", ss.gaugePoints);
        }

        // normalize gauge points to 100e6
        // gaugePoints is scaled up to uint256 to be normalized,
        // then downcasted. overflow cannot occur uint32.max > 100e6.
        for (uint256 i; i < LPSiloTokens.length; ++i) {
            Storage.SiloSettings storage ss = s.ss[LPSiloTokens[i]];
            ss.gaugePoints = uint32(uint256(ss.gaugePoints).mul(100e6).div(totalGaugePoints));
            console.log("token:" , LPSiloTokens[i]);
            console.log("gauge Points normalized:", ss.gaugePoints);
            emit GaugePointChange(
                s.season.current,
                LPSiloTokens[i],
                ss.gaugePoints
            );
        }
       
    }

    /**
     * @notice calculates the new gauge points for the given token.
     * @dev function calls the selector of the token's gauge point function.
     * If the gpSelector is 0x01, then the function uses the default GaugePoint function
     * See {GaugePointFacet.defaultGaugePointFunction()}
     */
    function getGaugePoints(
        bytes4 gpSelector,
        uint256 gaugePoints,
        uint256 optimalPercentDepositedBDV,
        uint256 percentOfDepositedBdv
    ) internal view returns (uint256 newGaugePoints) 
    {
        bytes memory callData = abi.encodeWithSelector(
                gpSelector,
                gaugePoints,
                optimalPercentDepositedBDV,
                percentOfDepositedBdv
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

    // TODO
    function updateGrownStalkEarnedPerSeason(
        uint256 maxLpGpPerBDV,
        LpGaugePointData[] memory lpGpData, 
        uint256 totalGaugePoints,
        uint256 totalLPBdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        console.log("-----------------------------------");
        console.log("updating Grown Stalk Earned Per Season:");
        // TODO: implment the decrement deposited BDV thing for unripe
        uint256 beanDepositedBdv = s.siloBalances[C.BEAN].depositedBdv;
        console.log("bean deposited BDV:", beanDepositedBdv);
        uint256 totalBdv = totalLPBdv.add(beanDepositedBdv);
        console.log("new totalBDV:", totalBdv);

        // if nothing has been deposited, skip grown stalk update.
        if(totalBdv == 0) return;

        // calculate the ratio between the bean and the max LP gauge points per BDV.
        // 6 decimal precision
        uint256 BeanToMaxLpGpPerBDVRatio = getBeanToMaxLpGpPerBDVRatioScaled(s.seedGauge.BeanToMaxLpGpPerBDVRatio);
        console.log("BeanToMaxLpGpPerBDVRatio:", BeanToMaxLpGpPerBDVRatio);
        // get the GaugePoints and GPperBDV for bean 
        // beanGpPerBDV has 6 decimal preicison 
        uint256 beanGpPerBDV = maxLpGpPerBDV.mul(BeanToMaxLpGpPerBDVRatio).div(100e6);
        console.log("beanGpPerBDV:", beanGpPerBDV);

        totalGaugePoints = totalGaugePoints.add(beanGpPerBDV.mul(beanDepositedBdv).div(PRECISION));
        console.log("totalGaugePoints:", totalGaugePoints);

        // calculate grown stalk issued this season and GrownStalk Per GaugePoint.
        uint256 newGrownStalk = uint256(s.seedGauge.averageGrownStalkPerBdvPerSeason).mul(totalBdv).div(PRECISION);
        console.log("averageGrownStalkPerBdvPerSeason:", s.seedGauge.averageGrownStalkPerBdvPerSeason);
        console.log("newGrownStalk:", newGrownStalk);

        uint256 newGrownStalkPerGp = newGrownStalk.mul(1e6).div(totalGaugePoints);
        console.log("newGrownStalkPerGp:", newGrownStalkPerGp);

        // update stalkPerBDVPerSeason for bean.
        issueGrownStalkPerBDV(
            C.BEAN,
            newGrownStalkPerGp,
            beanGpPerBDV
        );

        // update stalkPerBdvPerSeason for LP 
        // if there is only one pool, then no need to read gauge points.
        if(lpGpData.length == 1) {
            issueGrownStalkPerBDV(
                lpGpData[0].lpToken,
                newGrownStalkPerGp,
                lpGpData[0].gpPerBDV
            );
        } else {
            for(uint256 i = 0; i < lpGpData.length; i++) {
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
     * @param GrownStalkPerGp the number of GrownStalk Per Gauge Point.
     * @param GpPerBDV the amount of GaugePoints per BDV the token has.
     */
    function issueGrownStalkPerBDV(
        address token, 
        uint256 GrownStalkPerGp,
        uint256 GpPerBDV
    ) internal {
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(
            token,
            uint32(GrownStalkPerGp.mul(GpPerBDV).div(PRECISION))
        );
        console.log("token:", token);
        console.log("seeds updated to:", uint32(GrownStalkPerGp.mul(GpPerBDV).div(PRECISION)));
    }

    /**
     * @notice get the optimal percent deposited in the silo
     * among LP.
     */
    function getOptimalPercentLPDepositedBDV(
        address token
    ) internal pure returns (uint256 optimalPercentDepositedBDV) 
    {
        if(token == C.BEAN_ETH_WELL){
            optimalPercentDepositedBDV = BEAN_ETH_OPTIMAL_PERCENT;
        } else {
            optimalPercentDepositedBDV = 0;
        }
    }

    /**
     * @notice returns the ratio between the bean and 
     * the max LP gauge points per BDV.
     * @dev s.seedGauge.BeanToMaxLpGpPerBDVRatio is a number between 0 and 100e6,
     * where f(0) = MIN_BEAN_MAX_LPGP_RATIO and f(100e6) = MAX_BEAN_MAX_LPGP_RATIO.
     */
    function getBeanToMaxLpGpPerBDVRatioScaled(
        uint256 BeanToMaxLpGpPerBDVRatio
    ) internal pure returns (uint256) {
        return uint256(BeanToMaxLpGpPerBDVRatio)
            .mul(BEAN_MAXLPGP_RANGE).div(ONE_HUNDRED_PERCENT)
            .add(MIN_BEAN_MAX_LPGP_RATIO);
    }

}