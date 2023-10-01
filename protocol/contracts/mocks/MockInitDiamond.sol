/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "../mocks/MockToken.sol";
import {AppStorage} from "../beanstalk/AppStorage.sol";
import "../C.sol";
import "contracts/beanstalk/init/InitWhitelist.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond is InitWhitelist {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

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

    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        


        C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);
        C.bean().approve(C.curveZapAddress(), type(uint256).max);
        C.usdc().approve(C.curveZapAddress(), type(uint256).max);
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

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

        s.w.t = 1;

        s.w.thisSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.period = C.getSeasonPeriod();
        s.season.timestamp = block.timestamp;
        s.season.start = s.season.period > 0 ?
            (block.timestamp / s.season.period) * s.season.period :
            block.timestamp;
        s.isFarm = 1;
        s.beanEthPrice = 1;
        s.usdEthPrice = 1;
        s.season.stemStartSeason = uint16(s.season.current);
        s.seedGauge.BeanToMaxLpGpPerBDVRatio = 50e18; // 50%
        // 4 + 4 + 2
        s.seedGauge.averageGrownStalkPerBdvPerSeason = 10e6;
        whitelistPools();
    }

}