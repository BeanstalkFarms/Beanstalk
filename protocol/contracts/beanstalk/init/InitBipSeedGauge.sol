/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "../../C.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {Weather} from "contracts/beanstalk/sun/SeasonFacet/Weather.sol";
import {LibSafeMathSigned96} from "contracts/libraries/LibSafeMathSigned96.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";


interface IGaugePointFacet {
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints);
}

interface ILiquidityWeightFacet {
    function maxWeight() external pure returns (uint256);
}

/**
 * @author Brean
 * @title InitBipSeedGauge initalizes the seed gauge, updates siloSetting Struct
 **/
contract InitBipSeedGauge is Weather {
    using SafeMath for uint256;
    using LibSafeMathSigned96 for int96;
    using LibSafeMath128 for uint128;
    using SafeCast for uint256;

    uint256 private constant TARGET_SEASONS_TO_CATCHUP = 4320;
    uint256 private constant PRECISION = 1e6;

    uint256 internal constant BEAN_UNMIGRATED_BDV = 306_693_996418; // ~300k BDV
    uint256 internal constant BEAN_3CRV_UNMIGRATED_BDV = 26_212_521946; // ~26k BDV
    uint256 internal constant UNRIPE_BEAN_UNMIGRATED_BDV = 3_230_682_326697; // 3.2m BDV
    uint256 internal constant UNRIPE_LP_UNMIGRATED_BDV = 6_782_494_411175; // 6.68m BDV

    // gauge point factor is used to scale up the gauge points of the bean and bean3crv pools.
    uint128 internal constant BEAN_ETH_INITAL_GAUGE_POINTS = 1000e18;

    // assumption is that unripe assets has been migrated to the bean-eth Wells.
    function init() external {

        // dewhitelist bean3crv.
        LibWhitelist.dewhitelistToken(C.CURVE_BEAN_METAPOOL);

        // update depositedBDV for bean, bean3crv, urBean, and urBeanETH.
        LibTokenSilo.incrementTotalDepositedBdv(
            C.BEAN,
            BEAN_UNMIGRATED_BDV - s.migratedBdvs[C.BEAN]
        );
        LibTokenSilo.incrementTotalDepositedBdv(
            C.CURVE_BEAN_METAPOOL,
            BEAN_3CRV_UNMIGRATED_BDV - s.migratedBdvs[C.CURVE_BEAN_METAPOOL]
        );
        LibTokenSilo.incrementTotalDepositedBdv(
            C.UNRIPE_BEAN,
            UNRIPE_BEAN_UNMIGRATED_BDV - s.migratedBdvs[C.UNRIPE_BEAN]
        );
        LibTokenSilo.incrementTotalDepositedBdv(
            C.UNRIPE_LP,
            UNRIPE_LP_UNMIGRATED_BDV - s.migratedBdvs[C.UNRIPE_LP]
        );

        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();

        bytes4 gpSelector = IGaugePointFacet.defaultGaugePointFunction.selector;
        bytes4 lwSelector = ILiquidityWeightFacet.maxWeight.selector;
        
        bytes4[5] memory gpSelectors = [bytes4(0), gpSelector, 0, 0, 0];
        bytes4[5] memory lwSelectors = [bytes4(0), lwSelector, 0, 0, 0];
        uint128[5] memory gaugePoints = [uint128(0), BEAN_ETH_INITAL_GAUGE_POINTS, 0, 0, 0];
        uint64[5] memory optimalPercentDepositedBdv = [uint64(0), 100e6, 0, 0, 0];
        
        uint128 totalBdv;
        for (uint i = 0; i < siloTokens.length; i++) {

            // previously, the milestone stem was stored truncated. The seed gauge system now stores
            // the value untruncated, and thus needs to update all previous milestone stems.
            // This is a one time update, and will not be needed in the future.
            s.ss[siloTokens[i]].milestoneStem = int96(s.ss[siloTokens[i]].milestoneStem.mul(1e6));

            // update gpSelector, lwSelector, gaugePoint,and optimalPercentDepositedBdv 
            s.ss[siloTokens[i]].gpSelector = gpSelectors[i];
            s.ss[siloTokens[i]].lwSelector = lwSelectors[i];
            s.ss[siloTokens[i]].gaugePoints = gaugePoints[i];
            s.ss[siloTokens[i]].optimalPercentDepositedBdv = optimalPercentDepositedBdv[i];

            // get depositedBDV to use later:
            totalBdv += s.siloBalances[siloTokens[i]].depositedBdv;

            // emit event
            emit LibWhitelist.UpdateGaugeSettings(
                siloTokens[i],
                gpSelectors[i],
                lwSelectors[i],
                optimalPercentDepositedBdv[i]
            );
        }
        // initalize seed gauge and emit events.
        s.seedGauge.beanToMaxLpGpPerBdvRatio = 33_333_333_333_333_333_333; // 33% (50% + 50%* (1/3) = 66%)
        s.seedGauge.averageGrownStalkPerBdvPerSeason = initializeAverageGrownStalkPerBdv(totalBdv);

        emit BeanToMaxLpGpPerBdvRatioChange(
            s.season.current,
            type(uint256).max,
            int80(s.seedGauge.beanToMaxLpGpPerBdvRatio)
        );

        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.seedGauge.averageGrownStalkPerBdvPerSeason
        );

        // initalize s.usdTokenPrice for the bean eth well.
        s.usdTokenPrice[C.BEAN_ETH_WELL] = 1;

        // set s.twaReserves for the bean eth well, and the bean:3crv pool.
        s.twaReserves[C.BEAN_ETH_WELL].reserve0 = 1;
        s.twaReserves[C.BEAN_ETH_WELL].reserve1 = 1;

        // initalize V2 cases.
        LibCases.setCasesV2();
    }

    /**
     * @notice initalizes the average grown stalk per BDV, based on the total BDV.
     */
    function initializeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint128) {
        uint256 averageGrownStalkPerBdv = s.s.stalk.div(totalBdv).sub(10000);
        return uint128(averageGrownStalkPerBdv.mul(PRECISION).div(TARGET_SEASONS_TO_CATCHUP));
    }
}
