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

        s.casesV2 = [
    //                Dsc soil demand,  Steady soil demand     Inc soil demand
    //                [mT][bT][mL][bL]    [mT][bT][mL][bL]    [mT][bT][mL][bL]
                    ///////////////// Exremely Low L2SR ///////////////////////
            bytes8(0x2710000327100032), 0x2710000127100032, 0x2710000027100032, // Exs Low: P < 1
                    0x2710ffff27100032, 0x2710fffd27100032, 0x2710fffd27100032, //          P > 1
                    0x2710ffff27100032, 0x2710fffd27100032, 0x2710fffd27100032, //          P > Q
                    0x2710000327100032, 0x2710000127100032, 0x2710000027100032, // Rea Low: P < 1
                    0x2710ffff27100032, 0x2710fffd27100032, 0x2710fffd27100032, //          P > 1
                    0x2710ffff27100032, 0x2710fffd27100032, 0x2710fffd27100032, //          P > Q
                    0x2710000327100032, 0x2710000327100032, 0x2710000127100032, // Rea Hgh: P < 1
                    0x2710000027100032, 0x2710ffff27100032, 0x2710fffd27100032, //          P > 1
                    0x2710000027100032, 0x2710ffff27100032, 0x2710fffd27100032, //          P > Q
                    0x2710000327100032, 0x2710000327100032, 0x2710000127100032, // Exs Hgh: P < 1
                    0x2710000027100032, 0x2710ffff27100032, 0x2710fffd27100032, //          P > 1
                    0x2710000027100032, 0x2710ffff27100032, 0x2710fffd27100032, //          P > Q
                    /////////////////// Reasonably Low L2SR ///////////////////
                    0x2710000327100019, 0x2710000327100019, 0x2710000027100019, // Exs Low: P < 1
                    0x2710ffff27100019, 0x2710fffd27100019, 0x2710fffd27100019, //          P > 1
                    0x2710ffff27100019, 0x2710fffd27100019, 0x2710fffd27100019, //          P > Q
                    0x2710000327100019, 0x2710000327100019, 0x2710000027100019, // Rea Low: P < 1
                    0x2710ffff27100019, 0x2710fffd27100019, 0x2710fffd27100019, //          P > 1
                    0x2710ffff27100019, 0x2710fffd27100019, 0x2710fffd27100019, //          P > Q
                    0x2710000327100019, 0x2710000327100019, 0x2710000327100019, // Rea Hgh: P < 1
                    0x2710000027100019, 0x2710ffff27100019, 0x2710fffd27100019, //          P > 1
                    0x2710000027100019, 0x2710ffff27100019, 0x2710fffd27100019, //          P > Q
                    0x2710000327100019, 0x2710000327100019, 0x2710000327100019, // Exs Hgh: P < 1
                    0x2710000027100019, 0x2710ffff27100019, 0x2710fffd27100019, //          P > 1
                    0x2710000027100019, 0x2710ffff27100019, 0x2710fffd27100019, //          P > Q
                    /////////////////// Reasonably High L2SR //////////////////
                    0x271000032710FFE7, 0x271000032710FFE7, 0x271000002710FFE7, // Exs Low: P < 1
                    0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x2710fffd2710FFE7, //          P > 1
                    0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x2710fffd2710FFE7, //          P > Q
                    0x271000032710FFE7, 0x271000032710FFE7, 0x271000002710FFE7, // Rea Low: P < 1
                    0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x2710fffd2710FFE7, //          P > 1
                    0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x2710fffd2710FFE7, //          P > Q
                    0x271000032710FFE7, 0x271000032710FFE7, 0x271000032710FFE7, // Rea Hgh: P < 1
                    0x271000002710FFE7, 0x2710ffff2710FFE7, 0x2710fffd2710FFE7, //          P > 1
                    0x271000002710FFE7, 0x2710ffff2710FFE7, 0x2710fffd2710FFE7, //          P > Q
                    0x271000032710FFE7, 0x271000032710FFE7, 0x271000032710FFE7, // Exs Hgh: P < 1
                    0x271000002710FFE7, 0x2710ffff2710FFE7, 0x2710fffd2710FFE7, //          P > 1
                    0x271000002710FFE7, 0x2710ffff2710FFE7, 0x2710fffd2710FFE7, //          P > Q
                    /////////////////// Extremely High L2SR ///////////////////
                    0x271000032710FFCE, 0x271000032710FFCE, 0x271000002710FFCE, // Exs Low: P < 1
                    0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x2710fffd2710FFCE, //          P > 1
                    0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x2710fffd2710FFCE, //          P > Q
                    0x271000032710FFCE, 0x271000032710FFCE, 0x271000002710FFCE, // Rea Low: P < 1
                    0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x2710fffd2710FFCE, //          P > 1
                    0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x2710fffd2710FFCE, //          P > Q
                    0x271000032710FFCE, 0x271000032710FFCE, 0x271000032710FFCE, // Rea Hgh: P < 1
                    0x271000002710FFCE, 0x2710ffff2710FFCE, 0x2710fffd2710FFCE, //          P > 1
                    0x271000002710FFCE, 0x2710ffff2710FFCE, 0x2710fffd2710FFCE, //          P > Q
                    0x271000032710FFCE, 0x271000032710FFCE, 0x271000032710FFCE, // Exs Hgh: P < 1
                    0x271000002710FFCE, 0x2710ffff2710FFCE, 0x2710fffd2710FFCE, //          P > 1
                    0x271000002710FFCE, 0x2710ffff2710FFCE, 0x2710fffd2710FFCE  //          P > Q
        ];

        // //////////////////////////////// Exremely Low L2SR ////////////////////////////////////////
        // //            Dsc soil demand, Steady soil demand,    Inc soil demand,                Null
        // //            [mT][bT][mL][bL]    [mT][bT][mL][bL]    [mT][bT][mL][bL]    [mT][bT][mL][bL]
        //     bytes8(0x2710000327100032), 0x2710000127100032, 0x2710000027100032, 0x0000000000000000, // Exs Low: P < 1
        //             0x2710ffff27100032, 0x2710fffd27100032, 0x2710fffd27100032, 0x0000000000000000, //          P > 1
        //             0x2710000327100032, 0x2710000127100032, 0x2710000027100032, 0x0000000000000000, // Rea Low: P < 1
        //             0x2710ffff27100032, 0x2710fffd27100032, 0x2710fffd27100032, 0x0000000000000000, //          P > 1
        //             0x2710000327100032, 0x2710000327100032, 0x2710000127100032, 0x0000000000000000, // Rea Hgh: P < 1
        //             0x2710000027100032, 0x2710ffff27100032, 0x2710fffd27100032, 0x0000000000000000, //          P > 1
        //             0x2710000327100032, 0x2710000327100032, 0x2710000127100032, 0x0000000000000000, // Exs Hgh: P < 1
        //             0x2710000027100032, 0x2710ffff27100032, 0x2710fffd27100032, 0x0000000000000000, //          P > 1
        // //////////////////////////////// Reasonably Low L2SR //////////////////////////////////////
        //             0x2710000327100019, 0x2710000327100019, 0x2710000027100019, 0x0000000000000000, // Exs Low: P < 1
        //             0x2710ffff27100019, 0x2710fffd27100019, 0x2710fffd27100019, 0x0000000000000000, //          P > 1
        //             0x2710000327100019, 0x2710000327100019, 0x2710000027100019, 0x0000000000000000, // Rea Low: P < 1
        //             0x2710ffff27100019, 0x2710fffd27100019, 0x2710fffd27100019, 0x0000000000000000, //          P > 1
        //             0x2710000327100019, 0x2710000327100019, 0x2710000327100019, 0x0000000000000000, // Rea Hgh: P < 1
        //             0x2710000027100019, 0x2710ffff27100019, 0x2710fffd27100019, 0x0000000000000000, //          P > 1
        //             0x2710000327100019, 0x2710000327100019, 0x2710000327100019, 0x0000000000000000, // Exs Hgh: P < 1
        //             0x2710000027100019, 0x2710ffff27100019, 0x2710fffd27100019, 0x0000000000000000, //          P > 1
        // //////////////////////////////// Reasonably High L2SR //////////////////////////////////////
        //             0x271000032710FFE7, 0x271000032710FFE7, 0x271000002710FFE7, 0x0000000000000000, // Exs Low: P < 1
        //             0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x2710fffd2710FFE7, 0x0000000000000000, //          P > 1
        //             0x271000032710FFE7, 0x271000032710FFE7, 0x271000002710FFE7, 0x0000000000000000, // Rea Low: P < 1
        //             0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x2710fffd2710FFE7, 0x0000000000000000, //          P > 1
        //             0x271000032710FFE7, 0x271000032710FFE7, 0x271000032710FFE7, 0x0000000000000000, // Rea Hgh: P < 1
        //             0x271000002710FFE7, 0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x0000000000000000, //          P > 1
        //             0x271000032710FFE7, 0x271000032710FFE7, 0x271000032710FFE7, 0x0000000000000000, // Exs Hgh: P < 1
        //             0x271000002710FFE7, 0x2710ffff2710FFE7, 0x2710fffd2710FFE7, 0x0000000000000000, //          P > 1
        // //////////////////////////////// Extremely High L2SR //////////////////////////////////////
        //             0x271000032710FFCE, 0x271000032710FFCE, 0x271000002710FFCE, 0x0000000000000000, // Exs Low: P < 1
        //             0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x2710fffd2710FFCE, 0x0000000000000000, //          P > 1
        //             0x271000032710FFCE, 0x271000032710FFCE, 0x271000002710FFCE, 0x0000000000000000, // Rea Low: P < 1
        //             0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x2710fffd2710FFCE, 0x0000000000000000, //          P > 1
        //             0x271000032710FFCE, 0x271000032710FFCE, 0x271000032710FFCE, 0x0000000000000000, // Rea Hgh: P < 1
        //             0x271000002710FFCE, 0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x0000000000000000, //          P > 1
        //             0x271000032710FFCE, 0x271000032710FFCE, 0x271000032710FFCE, 0x0000000000000000, // Exs Hgh: P < 1
        //             0x271000002710FFCE, 0x2710ffff2710FFCE, 0x2710fffd2710FFCE, 0x0000000000000000  //          P > 1
                    
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
        s.seedGauge.percentOfNewGrownStalkToLP = 50e6; // 50%
        s.seedGauge.averageGrownStalkPerBdvPerSeason = 1e6;
        whitelistPools();
    }

}