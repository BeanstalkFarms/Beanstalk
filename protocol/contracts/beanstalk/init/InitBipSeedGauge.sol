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

/**
 * @author Brean
 * @title InitBipSeedGauge initalizes the seed gauge, updates siloSetting Struct
 **/
interface IGaugePointFacet {
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints);
}

contract InitBipSeedGauge is Weather {
    using SafeMath for uint256;
    using LibSafeMathSigned96 for int96;


    uint256 private constant TARGET_SEASONS_TO_CATCHUP = 4320;
    uint256 private constant PRECISION = 1e6;

    // TODO : update these values, once the beanEthMigration BIP has executed.
    uint256 internal constant BEAN_UNMIGRATED_BDV = 816_105_148629; // 816k BDV
    uint256 internal constant BEAN_3CRV_UNMIGRATED_BDV = 53_419_468565; // 53k BDV
    uint256 internal constant UNRIPE_BEAN_UNMIGRATED_BDV = 4_946_644_852785; // 4.9m BDV
    uint256 internal constant UNRIPE_LP_UNMIGRATED_BDV = 7_774_709_273192; // 7.7m BDV

    // assumption is that unripe assets has been migrated to the bean-eth Wells.
    function init() external {
        // update depositedBDV for bean, bean3crv, urBean, and urBeanETH:
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

        uint128 totalBdv;
        // only lp assets need to be updated.
        // unripeAssets are not in the seed gauge,
        // and bean does not have a gauge point function.
        // (it is based on the max gauge points of LP)
        // order: bean, beanETH, bean3CRV, urBEAN, urBEANETH
        uint128 beanEthToBean3CrvDepositedRatio = s.siloBalances[C.BEAN_ETH_WELL].depositedBdv * 1e6 /  s.siloBalances[C.CURVE_BEAN_METAPOOL].depositedBdv;
        address[] memory siloTokens = LibWhitelistedTokens.getWhitelistedTokens();
        uint128 beanEthGp = uint128(
            s.ss[C.BEAN_ETH_WELL].stalkEarnedPerSeason) * 500 * beanEthToBean3CrvDepositedRatio * 1e6;
        uint128 bean3crvGp = uint128(
            s.ss[C.CURVE_BEAN_METAPOOL].stalkEarnedPerSeason) * 500 * 1e12;
        uint128[5] memory gaugePoints = [uint128(0), beanEthGp, bean3crvGp, 0, 0];
        bytes4[5] memory gpSelectors = [
            bytes4(0x00000000),
            IGaugePointFacet.defaultGaugePointFunction.selector,
            IGaugePointFacet.defaultGaugePointFunction.selector,
            0x00000000,
            0x00000000
        ];
        uint96[5] memory optimalPercentDepositedBdv = [uint96(0), 99e6, 1e6, 0, 0];
        for (uint i = 0; i < siloTokens.length; i++) {
            // previously, the milestone stem was stored truncated. The seed gauge system now stores
            // the value untruncated, and thus needs to update all previous milestone stems. 
            // This is a one time update, and will not be needed in the future.
            s.ss[siloTokens[i]].milestoneStem = int96(s.ss[siloTokens[i]].milestoneStem.mul(1e6));

            // update gaugePoints and gpSelectors
            s.ss[siloTokens[i]].gaugePoints = gaugePoints[i];
            s.ss[siloTokens[i]].gpSelector = gpSelectors[i];
            s.ss[siloTokens[i]].optimalPercentDepositedBdv = optimalPercentDepositedBdv[i];

            // get depositedBDV to use later:
            totalBdv += s.siloBalances[siloTokens[i]].depositedBdv;
            
            // emit event
            emit LibWhitelist.UpdateGaugeSettings(siloTokens[i], gpSelectors[i], optimalPercentDepositedBdv[i]);
        }
        // initalize seed gauge and emit events.
        s.seedGauge.beanToMaxLpGpPerBdvRatio = 33_333_333_333_333_333_333; // 33% (50% + 50%* (1/3) = 66%)
        s.seedGauge.averageGrownStalkPerBdvPerSeason = initializeAverageGrownStalkPerBdv(totalBdv);

        emit BeanToMaxLpGpPerBdvRatioChange(s.season.current, type(uint256).max, int80(s.seedGauge.beanToMaxLpGpPerBdvRatio));
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(s.seedGauge.averageGrownStalkPerBdvPerSeason);

        // initalize s.usdTokenPrice for the bean eth well.
        s.usdTokenPrice[C.BEAN_ETH_WELL] = 1;

        // set s.twaReserves for the bean eth well, and the bean:3crv pool.
        s.twaReserves[C.BEAN_ETH_WELL].reserve0 = 1;
        s.twaReserves[C.BEAN_ETH_WELL].reserve1 = 1;

        // Even though it is not used, still initialize.
        s.usdTokenPrice[C.CURVE_BEAN_METAPOOL] = 1;
        s.twaReserves[C.CURVE_BEAN_METAPOOL].reserve0 = 1;
        s.twaReserves[C.CURVE_BEAN_METAPOOL].reserve1 = 1;

        // initalize V2 cases.
        LibCases.setCasesV2();
    }

    function initializeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint128) {
        uint256 averageGrownStalkPerBdv = s.s.stalk.div(totalBdv).sub(10000);
        return uint128(averageGrownStalkPerBdv.mul(PRECISION).div(TARGET_SEASONS_TO_CATCHUP));
    }
}
