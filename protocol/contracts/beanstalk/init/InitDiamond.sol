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
