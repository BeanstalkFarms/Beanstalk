/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";
import "~/C.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8.
**/

contract InitBipNewSilo {

    AppStorage internal s;

    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkPerBdvPerSeason,
        uint32 season
    );
    
    
    function init() external {
        console.log("InitBipNewSilo.init() got called");
        
        //update all silo info for current Silo-able assets

        s.ss[C.beanAddress()].stalkPerBdvPerSeason = 2;
        s.ss[C.beanAddress()].stalkPerBdv = 1;
        s.ss[C.beanAddress()].lastUpdateSeason = s.season.current;
        s.ss[C.beanAddress()].lastCumulativeGrownStalkPerBdv = 0;
        s.ss[C.beanAddress()].legacySeedsPerBdv = 2;


        s.ss[C.curveMetapoolAddress()].stalkPerBdvPerSeason = 4;
        s.ss[C.curveMetapoolAddress()].stalkPerBdv = 1;
        s.ss[C.curveMetapoolAddress()].lastUpdateSeason = s.season.current;
        s.ss[C.curveMetapoolAddress()].lastCumulativeGrownStalkPerBdv = 0;
        s.ss[C.curveMetapoolAddress()].legacySeedsPerBdv = 4;


        s.ss[C.unripeBeanAddress()].stalkPerBdvPerSeason = 2;
        s.ss[C.unripeBeanAddress()].stalkPerBdv = 1;
        s.ss[C.unripeBeanAddress()].lastUpdateSeason = s.season.current;
        s.ss[C.unripeBeanAddress()].lastCumulativeGrownStalkPerBdv = 0;
        s.ss[C.unripeBeanAddress()].legacySeedsPerBdv = 2;


        s.ss[address(C.unripeLP())].stalkPerBdvPerSeason = 2;
        s.ss[address(C.unripeLP())].stalkPerBdv = 1;
        s.ss[address(C.unripeLP())].lastUpdateSeason = s.season.current;
        s.ss[address(C.unripeLP())].lastCumulativeGrownStalkPerBdv = 0;
        s.ss[address(C.unripeLP())].legacySeedsPerBdv = 4;

        //emit event for unripe LP from 4 to 2 grown stalk per bdv per season
        emit UpdatedStalkPerBdvPerSeason(address(C.unripeLP()), 2, s.season.current);



        //set the grownStalkPerBdvStartSeason to the current season
        s.season.grownStalkPerBdvStartSeason = uint16(s.season.current); //storing as uint16 to save storage space
    }
}