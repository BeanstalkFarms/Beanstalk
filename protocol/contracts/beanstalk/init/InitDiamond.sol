/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage} from "../AppStorage.sol";
import {IERC165} from "../../interfaces/IERC165.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "../../interfaces/IDiamondLoupe.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibIncentive} from "../../libraries/LibIncentive.sol";
import "../../C.sol";
import "../../interfaces/IBean.sol";
import "../../interfaces/IWETH.sol";
import "../../mocks/MockToken.sol";

/**
 * @author Publius
 * @title Init Diamond initializes the Beanstalk Diamond.
**/
contract InitDiamond {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    address private constant PEG_PAIR = address(0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc);

    // constants are used for readability purposes:
    // PLUS: increment by X (y_i = y_1 + X) 
    // MINUS decrement by X (y_i = y_1 - X)
    // INCR/DECR: scale up/down by X (y_i = y_1 * X)
    // T: Temperature, L: Bean to max LP gauge point per BDV ratio

    //                                                          [  mT  ][][       mL         ][       BL         ][    null    ]
    bytes32 internal constant    T_PLUS_3_L_INCR_10 = bytes32(0x05F5E100030005F68E8131ECF80000000006F05B59D3B2000000000000000000);
    bytes32 internal constant    T_PLUS_1_L_INCR_10 = bytes32(0x05F5E100010005F68E8131ECF80000000006F05B59D3B2000000000000000000);
    bytes32 internal constant    T_PLUS_0_L_INCR_10 = bytes32(0x05F5E100000005F68E8131ECF80000000006F05B59D3B2000000000000000000);
    bytes32 internal constant   T_MINUS_1_L_INCR_10 = bytes32(0x05F5E100FF0005F68E8131ECF80000000006F05B59D3B2000000000000000000);
    bytes32 internal constant   T_MINUS_3_L_INCR_10 = bytes32(0x05F5E100FD0005F68E8131ECF80000000006F05B59D3B2000000000000000000);

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

        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata


        C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);
        C.bean().approve(C.curveZapAddress(), type(uint256).max);
        C.usdc().approve(C.curveZapAddress(), type(uint256).max);

    //     s.cases = [
    //    Dsc, Sdy, Inc, nul
    //    int8(3),   1,   0,   0,  // Exs Low: P < 1
    //         -1,  -3,  -3,   0,  //          P > 1
    //          3,   1,   0,   0,  // Rea Low: P < 1
    //         -1,  -3,  -3,   0,  //          P > 1
    //          3,   3,   1,   0,  // Rea Hgh: P < 1
    //          0,  -1,  -3,   0,  //          P > 1
    //          3,   3,   1,   0,  // Exs Hgh: P < 1
    //          0,  -1,  -3,   0   //          P > 1
    //     ];

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
        s.w.t = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.period = C.getSeasonPeriod();
        s.season.timestamp = block.timestamp;
        s.season.start = s.season.period > 0 ?
            (block.timestamp / s.season.period) * s.season.period :
            block.timestamp;

        s.w.thisSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;
        s.isFarm = 1;
        s.beanEthPrice = 1;
        s.usdEthPrice = 1;
        s.seedGauge.BeanToMaxLpGpPerBDVRatio = 50e6; // 50%
        s.seedGauge.averageGrownStalkPerBdvPerSeason = 10e6;
        s.season.stemStartSeason = uint16(s.season.current);

        C.bean().mint(msg.sender, LibIncentive.MAX_REWARD);
        emit Incentivization(msg.sender, LibIncentive.MAX_REWARD);
    }

}
