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

    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();


        C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);
        C.bean().approve(C.curveZapAddress(), type(uint256).max);
        C.usdc().approve(C.curveZapAddress(), type(uint256).max);
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata



    //     s.cases = [
    //     // Dsc, Sdy, Inc, nul
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
        ////////////////////////////// Exremely Low L2SR //////////////////////////////////////
        //          Dsc soil demand,    Steady soil demand, Inc soil demand,    null
            bytes8(0x0f4240030f424000), 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
        ////////////////////////////// Reasonably Low L2SR ////////////////////////////////////
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
        ////////////////////////////// Reasonably High L2SR ////////////////////////////////////
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
        ////////////////////////////// Extremely High L2SR ////////////////////////////////////
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Exs Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240010f424000, 0x0f4240000f424000, 0x0000000000000000, // Rea Low: P < 1
                    0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Rea Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000, //          P > 1
                    0x0f4240030f424000, 0x0f4240030f424000, 0x0f4240010f424000, 0x0000000000000000, // Exs Hgh: P < 1
                    0x0f4240000f424000, 0x0f4240ff0f424000, 0x0f4240fd0f424000, 0x0000000000000000  //          P > 1
        ];
        s.w.t = 1;

        s.w.thisSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;
    
        // s.refundStatus = 1;
        // s.beanRefundAmount = 1;
        // s.ethRefundAmount = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.period = C.getSeasonPeriod();
        s.season.timestamp = block.timestamp;
        s.season.start = s.season.period > 0 ?
            (block.timestamp / s.season.period) * s.season.period :
            block.timestamp;
        s.isFarm = 1;
        s.beanEthPrice = 1;
        s.season.stemStartSeason = uint16(s.season.current);
        whitelistPools();
    }

}