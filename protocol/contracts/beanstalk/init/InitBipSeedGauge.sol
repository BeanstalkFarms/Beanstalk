/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import "contracts/beanstalk/AppStorage.sol";
import "../../C.sol";
import "contracts/libraries/Silo/LibWhitelistedTokens.sol";
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
    AppStorage internal s;

    uint256 private constant TARGET_SEASONS_TO_CATCHUP = 4320;    
//                                                              [  mT  ][][       mL         ][       BL         ][    null    ]
    bytes32 internal constant    T_PLUS_3_L_INCR_10 = bytes32(0x05F5E100030005F68E8131ECF800000000000000000000000000000000000000);
    bytes32 internal constant    T_PLUS_1_L_INCR_10 = bytes32(0x05F5E100010005F68E8131ECF800000000000000000000000000000000000000);
    bytes32 internal constant    T_PLUS_0_L_INCR_10 = bytes32(0x05F5E100000005F68E8131ECF800000000000000000000000000000000000000);
    bytes32 internal constant   T_MINUS_1_L_INCR_10 = bytes32(0x05F5E100FF0005F68E8131ECF800000000000000000000000000000000000000);
    bytes32 internal constant   T_MINUS_3_L_INCR_10 = bytes32(0x05F5E100FD0005F68E8131ECF800000000000000000000000000000000000000);

    bytes32 internal constant   T_PLUS_1_L_PLUS_ONE = bytes32(0x05F5E1000100056BC75E2D6310000000000DE0B6B3A764000000000000000000);
    bytes32 internal constant   T_PLUS_3_L_PLUS_ONE = bytes32(0x05F5E1000300056BC75E2D6310000000000DE0B6B3A764000000000000000000);
    bytes32 internal constant   T_PLUS_0_L_PLUS_ONE = bytes32(0x05F5E1000000056BC75E2D6310000000000DE0B6B3A764000000000000000000);

    bytes32 internal constant   T_PLUS_1_L_PLUS_TWO = bytes32(0x05F5E1000100056BC75E2D6310000000001BC16D674EC8000000000000000000);
    bytes32 internal constant   T_PLUS_3_L_PLUS_TWO = bytes32(0x05F5E1000300056BC75E2D6310000000001BC16D674EC8000000000000000000);

    bytes32 internal constant T_MINUS_1_L_MINUS_ONE = bytes32(0x05F5E100FF00056BC75E2D63100000FFFFF21F494C589C000000000000000000);
    bytes32 internal constant T_MINUS_3_L_MINUS_ONE = bytes32(0x05F5E100FD00056BC75E2D63100000FFFFF21F494C589C000000000000000000);
    bytes32 internal constant  T_PLUS_3_L_MINUS_ONE = bytes32(0x05F5E1000300056BC75E2D63100000FFFFF21F494C589C000000000000000000);
    bytes32 internal constant  T_PLUS_1_L_MINUS_ONE = bytes32(0x05F5E1000100056BC75E2D63100000FFFFF21F494C589C000000000000000000);
    bytes32 internal constant  T_PLUS_0_L_MINUS_ONE = bytes32(0x05F5E1000000056BC75E2D63100000FFFFF21F494C589C000000000000000000);


    // TODO : update these values 
    uint256 internal constant BEAN_MIGRATED_BDV = 0;
    uint256 internal constant BEAN_3CRV_MIGRATED_BDV = 0;
    uint256 internal constant UR_BEAN_MIGRATED_BDV = 0;
    uint256 internal constant UR_BEAN_ETH_MIGRATED_BDV = 0;

    uint256 internal constant BEAN_UN_MIGRATED_BDV = 0;
    uint256 internal constant BEAN_3CRV_UN_MIGRATED_BDV = 0;
    uint256 internal constant UR_BEAN_UN_MIGRATED_BDV = 0;
    uint256 internal constant UR_BEAN_ETH_UN_MIGRATED_BDV = 0;

    // assumption is that unripe assets has been migrated to the bean-eth Wells.
    function init() external {
        // update depositedBDV for bean, bean3crv, urBean, and urBeanETH:
        LibTokenSilo.incrementTotalDepositedBdv(C.BEAN, BEAN_UN_MIGRATED_BDV - BEAN_MIGRATED_BDV);
        LibTokenSilo.incrementTotalDepositedBdv(C.BEAN_3CRV, BEAN_UN_MIGRATED_BDV - BEAN_MIGRATED_BDV);
        LibTokenSilo.incrementTotalDepositedBdv(C.UR_BEAN, UR_BEAN_UN_MIGRATED_BDV - UR_BEAN_MIGRATED_BDV);
        LibTokenSilo.incrementTotalDepositedBdv(C.UR_BEAN_ETH, UR_BEAN_ETH_UN_MIGRATED_BDV - UR_BEAN_ETH_MIGRATED_BDV);

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
        s.seedGauge.BeanToMaxLpGpPerBDVRatio = 50e18; // 50% // TODO: how to set this?
        s.seedGauge.averageGrownStalkPerBdvPerSeason =  initalizeAverageGrownStalkPerBdv(totalBdv);

        // initalize s.usdEthPrice 
        s.usdEthPrice = 1;

        // initalize V2 cases.
         s.casesV2 = [
//               Dsc soil demand,  Steady soil demand  Inc soil demand
                        ///////////////// Exremely Low L2SR ///////////////////////
            bytes32(T_PLUS_3_L_INCR_10),    T_PLUS_1_L_INCR_10,    T_PLUS_0_L_INCR_10, // Exs Low: P < 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                     T_PLUS_3_L_INCR_10,    T_PLUS_1_L_INCR_10,    T_PLUS_0_L_INCR_10, // Rea Low: P < 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                     T_PLUS_3_L_INCR_10,    T_PLUS_3_L_INCR_10,    T_PLUS_1_L_INCR_10, // Rea Hgh: P < 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                     T_PLUS_3_L_INCR_10,    T_PLUS_3_L_INCR_10,    T_PLUS_1_L_INCR_10, // Exs Hgh: P < 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                        /////////////////// Reasonably Low L2SR ///////////////////
                     T_PLUS_3_L_INCR_10,    T_PLUS_1_L_INCR_10,    T_PLUS_0_L_INCR_10, // Exs Low: P < 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                     T_PLUS_3_L_INCR_10,    T_PLUS_1_L_INCR_10,    T_PLUS_0_L_INCR_10, // Rea Low: P < 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE, // Rea Hgh: P < 1
                   T_PLUS_0_L_MINUS_ONE, T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE, // Exs Hgh: P < 1
                   T_PLUS_0_L_MINUS_ONE, T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                        /////////////////// Reasonably High L2SR //////////////////
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE,   T_PLUS_0_L_PLUS_ONE, // Exs Low: P < 1
                  T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE,   T_PLUS_0_L_PLUS_ONE, // Rea Low: P < 1
                  T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE, // Rea Hgh: P < 1
                   T_PLUS_0_L_MINUS_ONE, T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE, // Exs Hgh: P < 1
                   T_PLUS_0_L_MINUS_ONE, T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                         /////////////////// Extremely High L2SR ///////////////////
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE, // Exs Low: P < 1
                  T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE,   T_PLUS_1_L_PLUS_ONE, // Rea Low: P < 1
                  T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                    T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_TWO,   T_PLUS_3_L_PLUS_TWO,   T_PLUS_1_L_PLUS_TWO, // Rea Hgh: P < 1
                   T_PLUS_0_L_MINUS_ONE, T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10, //          P > Q
                    T_PLUS_3_L_PLUS_TWO,   T_PLUS_3_L_PLUS_TWO,   T_PLUS_1_L_PLUS_TWO, // Exs Hgh: P < 1
                   T_PLUS_0_L_MINUS_ONE, T_MINUS_1_L_MINUS_ONE, T_MINUS_3_L_MINUS_ONE, //          P > 1
                     T_PLUS_0_L_INCR_10,   T_MINUS_1_L_INCR_10,   T_MINUS_3_L_INCR_10  //          P > Q
        ];
    }

    function initalizeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint128) {
        uint256 averageGrownStalkPerBdv = s.s.stalk / totalBdv - 10000;
        return uint128(averageGrownStalkPerBdv / TARGET_SEASONS_TO_CATCHUP);
    }
}