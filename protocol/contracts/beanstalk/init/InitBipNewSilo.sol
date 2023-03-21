/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";
import "~/C.sol";
import {IERC1155} from "~/interfaces/IERC1155.sol";
import {LibDiamond} from "~/libraries/LibDiamond.sol";


/**
 * @author Publius
 * @title InitBipNewSilo runs the code for the silo update.
**/

contract InitBipNewSilo {

    AppStorage internal s;
    LibDiamond.DiamondStorage internal ds;


    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
        uint32 season
    );
    
    
    function init() external {
        
        // this adds the ERC1155 indentifier to the diamond:
        ds.supportedInterfaces[type(IERC1155).interfaceId] = true;

        //update all silo info for current Silo-able assets

        uint32 currentSeason = s.season.current;

        s.ss[C.beanAddress()].stalkEarnedPerSeason = 2*1e6;
        s.ss[C.beanAddress()].stalkIssuedPerBdv = 10000;
        s.ss[C.beanAddress()].milestoneSeason = currentSeason;
        s.ss[C.beanAddress()].milestoneStem = 0;


        s.ss[C.curveMetapoolAddress()].stalkEarnedPerSeason = 4*1e6;
        s.ss[C.curveMetapoolAddress()].stalkIssuedPerBdv = 10000;
        s.ss[C.curveMetapoolAddress()].milestoneSeason = currentSeason;
        s.ss[C.curveMetapoolAddress()].milestoneStem = 0;


        s.ss[C.unripeBeanAddress()].stalkEarnedPerSeason = 2*1e6;
        s.ss[C.unripeBeanAddress()].stalkIssuedPerBdv = 10000;
        s.ss[C.unripeBeanAddress()].milestoneSeason = currentSeason;
        s.ss[C.unripeBeanAddress()].milestoneStem = 0;


        s.ss[address(C.unripeLP())].stalkEarnedPerSeason = 2*1e6;
        s.ss[address(C.unripeLP())].stalkIssuedPerBdv = 10000;
        s.ss[address(C.unripeLP())].milestoneSeason = currentSeason;
        s.ss[address(C.unripeLP())].milestoneStem = 0;

        //emit event for unripe LP from 4 to 2 grown stalk per bdv per season
        emit UpdatedStalkPerBdvPerSeason(address(C.unripeLP()), 2, s.season.current);



        //set the stemStartSeason to the current season
        s.season.stemStartSeason = uint16(s.season.current); //storing as uint16 to save storage space
    }
}