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

    bytes32 internal constant PLUS_3_PLUS_50 = bytes32(0x05F5E1000300056BC75E2D63100000000006F05B59D3B2000000000000000000);
    bytes32 internal constant PLUS_1_PLUS_50 = bytes32(0x05F5E1000100056BC75E2D63100000000006F05B59D3B2000000000000000000);
    bytes32 internal constant PLUS_0_PLUS_50 = bytes32(0x05F5E1000000056BC75E2D63100000000006F05B59D3B2000000000000000000);

    bytes32 internal constant MINUS_1_PLUS_50 = bytes32(0x05F5E100FF00056BC75E2D63100000000006F05B59D3B2000000000000000000);
    bytes32 internal constant MINUS_3_PLUS_50 = bytes32(0x05F5E100FD00056BC75E2D63100000000006F05B59D3B2000000000000000000);


    bytes32 internal constant PLUS_3_PLUS_25 = bytes32(0x05F5E1000300056BC75E2D63100000000003782DACE9D9000000000000000000);
    bytes32 internal constant PLUS_1_PLUS_25 = bytes32(0x05F5E1000100056BC75E2D63100000000003782DACE9D9000000000000000000);
    bytes32 internal constant PLUS_0_PLUS_25 = bytes32(0x05F5E1000000056BC75E2D63100000000003782DACE9D9000000000000000000);

    bytes32 internal constant MINUS_1_PLUS_25 = bytes32(0x05F5E100FF00056BC75E2D63100000000003782DACE9D9000000000000000000);
    bytes32 internal constant MINUS_3_PLUS_25 = bytes32(0x05F5E100FD00056BC75E2D63100000000003782DACE9D9000000000000000000);


    bytes32 internal constant PLUS_3_MINUS_25 = bytes32(0x05F5E1000300056BC75E2D63100000FFFFFC87D2531627000000000000000000);
    bytes32 internal constant PLUS_1_MINUS_25 = bytes32(0x05F5E1000100056BC75E2D63100000FFFFFC87D2531627000000000000000000);
    bytes32 internal constant PLUS_0_MINUS_25 = bytes32(0x05F5E1000000056BC75E2D63100000FFFFFC87D2531627000000000000000000);

    bytes32 internal constant MINUS_1_MINUS_25 = bytes32(0x05F5E100FF00056BC75E2D63100000FFFFFC87D2531627000000000000000000);
    bytes32 internal constant MINUS_3_MINUS_25 = bytes32(0x05F5E100FD00056BC75E2D63100000FFFFFC87D2531627000000000000000000);


    bytes32 internal constant PLUS_3_MINUS_50 = bytes32(0x05F5E1000300056BC75E2D63100000FFFFF90FA4A62C4E000000000000000000);
    bytes32 internal constant PLUS_1_MINUS_50 = bytes32(0x05F5E1000300056BC75E2D63100000FFFFF90FA4A62C4E000000000000000000);
    bytes32 internal constant PLUS_0_MINUS_50 = bytes32(0x05F5E1000300056BC75E2D63100000FFFFF90FA4A62C4E000000000000000000);

    bytes32 internal constant MINUS_1_MINUS_50 = bytes32(0x05F5E100FF00056BC75E2D63100000FFFFF90FA4A62C4E000000000000000000);
    bytes32 internal constant MINUS_3_MINUS_50 = bytes32(0x05F5E100FD00056BC75E2D63100000FFFFF90FA4A62C4E000000000000000000);

    // assumption is that unripe assets has been migrated to the bean-eth Wells.
    function init() external {
        uint128 totalBdv;
        // bean, beanETH, bean3CRV, urBEAN, urBEAN3CRV
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokensWithUnripe();
        // only lp assets need to be updated.
        // unripeAssets are not in the seed gauge, 
        // and bean does not have a gauge point function. 
        // (it is based on the max gauge points of LP)
        uint128[5] memory gaugePoints = [uint128(0), 95e18, 5e18, 0, 0];
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
            bytes32(PLUS_3_PLUS_50),  PLUS_1_PLUS_50,  PLUS_0_PLUS_50, // Exs Low: P < 1
                    MINUS_1_PLUS_50, MINUS_3_PLUS_50, MINUS_3_PLUS_50, //          P > 1
                    MINUS_1_PLUS_50, MINUS_3_PLUS_50, MINUS_3_PLUS_50, //          P > Q
                     PLUS_3_PLUS_50,  PLUS_1_PLUS_50,  PLUS_0_PLUS_50, // Rea Low: P < 1
                    MINUS_1_PLUS_50, MINUS_3_PLUS_50, MINUS_3_PLUS_50, //          P > 1
                    MINUS_1_PLUS_50, MINUS_3_PLUS_50, MINUS_3_PLUS_50, //          P > Q
                     PLUS_3_PLUS_50,  PLUS_3_PLUS_50,  PLUS_1_PLUS_50, // Rea Hgh: P < 1
                     PLUS_0_PLUS_50, MINUS_1_PLUS_50, MINUS_3_PLUS_50, //          P > 1
                     PLUS_0_PLUS_50, MINUS_1_PLUS_50, MINUS_3_PLUS_50, //          P > Q
                     PLUS_3_PLUS_50,  PLUS_3_PLUS_50,  PLUS_1_PLUS_50, // Exs Hgh: P < 1
                     PLUS_0_PLUS_50, MINUS_1_PLUS_50, MINUS_3_PLUS_50, //          P > 1
                     PLUS_0_PLUS_50, MINUS_1_PLUS_50, MINUS_3_PLUS_50, //          P > Q
            /////////////////// Reasonably Low L2SR ///////////////////
                     PLUS_3_PLUS_25,  PLUS_1_PLUS_25,  PLUS_0_PLUS_25, // Exs Low: P < 1
                    MINUS_1_PLUS_25, MINUS_3_PLUS_25, MINUS_3_PLUS_25, //          P > 1
                    MINUS_1_PLUS_25, MINUS_3_PLUS_25, MINUS_3_PLUS_25, //          P > Q
                     PLUS_3_PLUS_25,  PLUS_1_PLUS_25,  PLUS_0_PLUS_25, // Rea Low: P < 1
                    MINUS_1_PLUS_25, MINUS_3_PLUS_25, MINUS_3_PLUS_25, //          P > 1
                    MINUS_1_PLUS_25, MINUS_3_PLUS_25, MINUS_3_PLUS_25, //          P > Q
                     PLUS_3_PLUS_25,  PLUS_3_PLUS_25,  PLUS_1_PLUS_25, // Rea Hgh: P < 1
                     PLUS_0_PLUS_25, MINUS_1_PLUS_25, MINUS_3_PLUS_25, //          P > 1
                     PLUS_0_PLUS_25, MINUS_1_PLUS_25, MINUS_3_PLUS_25, //          P > Q
                     PLUS_3_PLUS_25,  PLUS_3_PLUS_25,  PLUS_1_PLUS_25, // Exs Hgh: P < 1
                     PLUS_0_PLUS_25, MINUS_1_PLUS_25, MINUS_3_PLUS_25, //          P > 1
                     PLUS_0_PLUS_25, MINUS_1_PLUS_25, MINUS_3_PLUS_25, //          P > Q
            /////////////////// Reasonably High L2SR //////////////////
                  PLUS_3_MINUS_25,  PLUS_1_MINUS_25,  PLUS_0_MINUS_25, // Exs Low: P < 1
                 MINUS_1_MINUS_25, MINUS_3_MINUS_25, MINUS_3_MINUS_25, //          P > 1
                 MINUS_1_MINUS_25, MINUS_3_MINUS_25, MINUS_3_MINUS_25, //          P > Q
                  PLUS_3_MINUS_25,  PLUS_1_MINUS_25,  PLUS_0_MINUS_25, // Rea Low: P < 1
                 MINUS_1_MINUS_25, MINUS_3_MINUS_25, MINUS_3_MINUS_25, //          P > 1
                 MINUS_1_MINUS_25, MINUS_3_MINUS_25, MINUS_3_MINUS_25, //          P > Q
                  PLUS_3_MINUS_25,  PLUS_3_MINUS_25,  PLUS_1_MINUS_25, // Rea Hgh: P < 1
                  PLUS_0_MINUS_25, MINUS_1_MINUS_25, MINUS_3_MINUS_25, //          P > 1
                  PLUS_0_MINUS_25, MINUS_1_MINUS_25, MINUS_3_MINUS_25, //          P > Q
                  PLUS_3_MINUS_25,  PLUS_3_MINUS_25,  PLUS_1_MINUS_25, // Exs Hgh: P < 1
                  PLUS_0_MINUS_25, MINUS_1_MINUS_25, MINUS_3_MINUS_25, //          P > 1
                  PLUS_0_MINUS_25, MINUS_1_MINUS_25, MINUS_3_MINUS_25, //          P > Q
            /////////////////// Extremely High L2SR ///////////////////
                  PLUS_3_MINUS_50,  PLUS_1_MINUS_50,  PLUS_0_MINUS_50, // Exs Low: P < 1
                 MINUS_1_MINUS_50, MINUS_3_MINUS_50, MINUS_3_MINUS_50, //          P > 1
                 MINUS_1_MINUS_50, MINUS_3_MINUS_50, MINUS_3_MINUS_50, //          P > Q
                  PLUS_3_MINUS_50,  PLUS_1_MINUS_50,  PLUS_0_MINUS_50, // Rea Low: P < 1
                 MINUS_1_MINUS_50, MINUS_3_MINUS_50, MINUS_3_MINUS_50, //          P > 1
                 MINUS_1_MINUS_50, MINUS_3_MINUS_50, MINUS_3_MINUS_50, //          P > Q
                  PLUS_3_MINUS_50,  PLUS_3_MINUS_50,  PLUS_1_MINUS_50, // Rea Hgh: P < 1
                  PLUS_0_MINUS_50, MINUS_1_MINUS_50, MINUS_3_MINUS_50, //          P > 1
                  PLUS_0_MINUS_50, MINUS_1_MINUS_50, MINUS_3_MINUS_50, //          P > Q
                  PLUS_3_MINUS_50,  PLUS_3_MINUS_50,  PLUS_1_MINUS_50, // Exs Hgh: P < 1
                  PLUS_0_MINUS_50, MINUS_1_MINUS_50, MINUS_3_MINUS_50, //          P > 1
                  PLUS_0_MINUS_50, MINUS_1_MINUS_50, MINUS_3_MINUS_50  //          P > Q
        ];
    }

    function initalizeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint128) {
        uint256 averageGrownStalkPerBdv = s.s.stalk / totalBdv - 10000;
        return uint128(averageGrownStalkPerBdv / TARGET_SEASONS_TO_CATCHUP);
    }
}