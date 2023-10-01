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
        s.seedGauge.BeanToMaxLpGpPerBDVRatio = 0.5e6; // 50% // TODO: how to set this?
        s.seedGauge.averageGrownStalkPerBdvPerSeason =  initalizeAverageGrownStalkPerBdv(totalBdv);

        // initalize s.usdEthPrice 
        s.usdEthPrice = 1;

        // initalize V2 cases.
        s.casesV2 = [
        //////////////////////////////// Exremely Low L2SR ////////////////////////////////////////
        //          Dsc soil demand,    Steady soil demand, Inc soil demand,    null
            bytes8(0x0f4240030f424000), 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
        //////////////////////////////// Reasonably Low L2SR //////////////////////////////////////
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
        //////////////////////////////// Reasonably High L2SR //////////////////////////////////////
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
        //////////////////////////////// Extremely High L2SR //////////////////////////////////////
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000  //          P > 1
        ];
    }

    function initalizeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint128) {
        uint256 averageGrownStalkPerBdv = s.s.stalk / totalBdv - 10000;
        return uint128(averageGrownStalkPerBdv / TARGET_SEASONS_TO_CATCHUP);
    }
}