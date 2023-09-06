/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import "contracts/beanstalk/AppStorage.sol";
import "../../C.sol";
import "contracts/libraries/Silo/LibWhitelistedTokens.sol";
/**
 * @author Publius, Brean
 * @title InitBipSeedGauge initalizes the seed gauge, updates siloSetting Struct 
 **/

contract InitBipSeedGauge{    
    AppStorage internal s;

    uint256 private constant TARGET_SEASONS_TO_CATCHUP = 4380;    
    
    struct OldSiloSettings {
        bytes4 selector;
        uint32 stalkEarnedPerSeason; 
        uint32 stalkIssuedPerBdv;
		uint32 milestoneSeason;
		int96 milestoneStem;
        bytes1 encodeType; 
    }
    // reference
    struct NewSiloSettings {
        bytes4 selector; // ─────────────┐ 4
        uint24 stalkEarnedPerSeason; //  │ 3  (7)
        uint16 stalkIssuedPerBdv; //     │ 2  (9)
		uint24 milestoneSeason; //       │ 3  (12)
		int96 milestoneStem; //          │ 12 (24)
        bytes1 encodeType; //            │ 1  (25)
        uint24 lpGaugePoints; //         │ 3  (28)
        bytes4 GPSelector; //  ──────────┘ 4  (32)
    }



    // assumption is that unripe assets has been migrated to the bean-eth Wells.
    function init() external {

        // update silo settings from old storage to new storage struct.
        OldSiloSettings storage oldSiloSettings;
        Storage.SiloSettings memory newSiloSettings;

        uint128 totalBdv;
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();
        uint24[5] memory lpGaugePoints = [uint24(0),0,0,0,0];
        bytes4[5] memory GPSelectors = [bytes4(0x00000000),0x00000000,0x00000000,0x00000000, 0x00000000];
        for(uint i = 0; i < siloTokens.length; i++) {
            Storage.SiloSettings storage ss = s.ss[siloTokens[i]];
            assembly {
                oldSiloSettings.slot := ss.slot
            }
            newSiloSettings.selector = oldSiloSettings.selector;
            newSiloSettings.stalkEarnedPerSeason = uint24(oldSiloSettings.stalkEarnedPerSeason);
            newSiloSettings.stalkIssuedPerBdv = uint16(oldSiloSettings.stalkIssuedPerBdv);
            newSiloSettings.milestoneSeason = uint24(oldSiloSettings.milestoneSeason);
            newSiloSettings.milestoneStem = oldSiloSettings.milestoneStem;
            newSiloSettings.encodeType = oldSiloSettings.encodeType;
            //TODO: add lpGaugePoints and GPSelector
            newSiloSettings.lpGaugePoints = lpGaugePoints[i];
            newSiloSettings.GPSelector = GPSelectors[i];

            s.ss[siloTokens[i]] = newSiloSettings;

            // get depositedBDV to use later:
            totalBdv += s.siloBalances[siloTokens[i]].depositedBdv;
        }
        // initalize seed gauge. 
        s.seedGauge.percentOfNewGrownStalkToLP = 0.5e6; // 50% // TODO: how to set this?
        s.seedGauge.averageGrownStalkPerBdvPerSeason =  initalizeAverageGrownStalkPerBdv(totalBdv);

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

    function initalizeAverageGrownStalkPerBdv(uint256 totalBdv) internal view returns (uint96) {
        uint256 averageGrownStalkPerBdv = s.s.stalk / totalBdv - 10000;
        return uint96(averageGrownStalkPerBdv / TARGET_SEASONS_TO_CATCHUP);
    }
}