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

    AppStorage internal s; //                                           bT
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


    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        


        C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);
        C.bean().approve(C.curveZapAddress(), type(uint256).max);
        C.usdc().approve(C.curveZapAddress(), type(uint256).max);
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

            s.casesV2 = [
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