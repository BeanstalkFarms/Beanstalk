/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";
import "~/C.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {LibDiamond} from "~/libraries/LibDiamond.sol";


/**
 * @author Publius
 * @title InitBipNewSilo runs the code for the silo update.
**/

contract InitBipNewSilo {

    AppStorage internal s;
    LibDiamond.DiamondStorage internal ds;

    uint32 constant private BEAN_SEEDS_PER_BDV = 2e6;
    uint32 constant private BEAN_3CRV_SEEDS_PER_BDV = 4e6;
    uint32 constant private UNRIPE_BEAN_SEEDS_PER_BDV = 1e6;
    uint32 constant private UNRIPE_BEAN_3CRV_SEEDS_PER_BDV = 1e6;
    
    uint32 constant private STALK_ISSUED_PER_BDV = 10000;


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

        s.ss[C.BEAN].stalkEarnedPerSeason = BEAN_SEEDS_PER_BDV;
        s.ss[C.BEAN].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.ss[C.BEAN].milestoneSeason = currentSeason;
        s.ss[C.BEAN].milestoneStem = 0;


        s.ss[C.CURVE_BEAN_METAPOOL].stalkEarnedPerSeason = BEAN_3CRV_SEEDS_PER_BDV;
        s.ss[C.CURVE_BEAN_METAPOOL].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.ss[C.CURVE_BEAN_METAPOOL].milestoneSeason = currentSeason;
        s.ss[C.CURVE_BEAN_METAPOOL].milestoneStem = 0;


        s.ss[C.UNRIPE_BEAN].stalkEarnedPerSeason = UNRIPE_BEAN_SEEDS_PER_BDV;
        s.ss[C.UNRIPE_BEAN].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.ss[C.UNRIPE_BEAN].milestoneSeason = currentSeason;
        s.ss[C.UNRIPE_BEAN].milestoneStem = 0;


        s.ss[address(C.unripeLP())].stalkEarnedPerSeason = UNRIPE_BEAN_3CRV_SEEDS_PER_BDV;
        s.ss[address(C.unripeLP())].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.ss[address(C.unripeLP())].milestoneSeason = currentSeason;
        s.ss[address(C.unripeLP())].milestoneStem = 0;

        //emit event for unripe LP/Beans from 4 to 1 grown stalk per bdv per season
        emit UpdatedStalkPerBdvPerSeason(address(C.unripeLP()), UNRIPE_BEAN_3CRV_SEEDS_PER_BDV, s.season.current);
        emit UpdatedStalkPerBdvPerSeason(address(C.unripeBean()), UNRIPE_BEAN_SEEDS_PER_BDV, s.season.current);



        //set the stemStartSeason to the current season
        s.season.stemStartSeason = uint16(s.season.current); //storing as uint16 to save storage space
    }
}