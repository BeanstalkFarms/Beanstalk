/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import "contracts/beanstalk/AppStorage.sol";
import "../../C.sol";
import "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import "contracts/libraries/Silo/LibTokenSilo.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";

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
contract InitBipSeedGauge{

    using SafeMath for uint256;

    AppStorage internal s;

    uint256 private constant TARGET_SEASONS_TO_CATCHUP = 4320; 
    uint256 private constant PRECISION = 1e6;   

    // TODO : update these values, once the beanEthMigration BIP has executed.
    uint256 internal constant BEAN_UN_MIGRATED_BDV = 816_105_148629; // 816k BDV
    uint256 internal constant BEAN_3CRV_UN_MIGRATED_BDV = 53_419_468565; // 53k BDV
    uint256 internal constant UNRIPE_BEAN_UN_MIGRATED_BDV = 4_946_644_852785; // 4.9m BDV
    uint256 internal constant UNRIPE_LP_UN_MIGRATED_BDV = 7_774_709_273192; // 7.7m BDV

    // assumption is that unripe assets has been migrated to the bean-eth Wells.
    function init() external {
        // update depositedBDV for bean, bean3crv, urBean, and urBeanETH:
        LibTokenSilo.incrementTotalDepositedBdv(C.BEAN, BEAN_UN_MIGRATED_BDV - s.migratedBdvs[C.BEAN]);
        LibTokenSilo.incrementTotalDepositedBdv(C.CURVE_BEAN_METAPOOL, BEAN_3CRV_UN_MIGRATED_BDV - s.migratedBdvs[C.CURVE_BEAN_METAPOOL]);
        LibTokenSilo.incrementTotalDepositedBdv(C.UNRIPE_BEAN, UNRIPE_BEAN_UN_MIGRATED_BDV - s.migratedBdvs[C.UNRIPE_BEAN]);
        LibTokenSilo.incrementTotalDepositedBdv(C.UNRIPE_LP, UNRIPE_LP_UN_MIGRATED_BDV - s.migratedBdvs[C.UNRIPE_LP]);

        uint128 totalBdv;
        // bean, beanETH, bean3CRV, urBEAN, urBEAN3CRV
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokensWithUnripe();
        // only lp assets need to be updated.
        // unripeAssets are not in the seed gauge, 
        // and bean does not have a gauge point function. 
        // (it is based on the max gauge points of LP)
        uint128[5] memory gaugePoints = [uint128(0), 95e18, 5e18, 0, 0]; // TODO: how to set this?
        bytes4[5] memory gpSelectors = [
            bytes4(0x00000000),
            IGaugePointFacet.defaultGaugePointFunction.selector,
            IGaugePointFacet.defaultGaugePointFunction.selector,
            0x00000000,
            0x00000000
        ];
        for(uint i = 0; i < siloTokens.length; i++) {
            // update gaugePoints and gpSelectors
            s.ss[siloTokens[i]].gaugePoints = gaugePoints[i];
            s.ss[siloTokens[i]].gpSelector = gpSelectors[i];

            // get depositedBDV to use later:
            totalBdv += s.siloBalances[siloTokens[i]].depositedBdv;
        }
        // initalize seed gauge. 
        s.seedGauge.beanToMaxLpGpPerBDVRatio = 50e18; // 50% // TODO: how to set this?
        s.seedGauge.averageGrownStalkPerBdvPerSeason =  initalizeAverageGrownStalkPerBdv(totalBdv);

        // initalize s.usdEthPrice 
        s.usdEthPrice = 1;

        // initalize V2 cases.
        s.casesV2 = LibCases.getCasesV2();
    }

    function initalizeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint128) {
      uint256 averageGrownStalkPerBdv = s.s.stalk.div(totalBdv).sub(10000);
      return uint128(averageGrownStalkPerBdv.mul(PRECISION).div(TARGET_SEASONS_TO_CATCHUP));
    }
}