/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";
import "contracts/C.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";

/**
 * @author Publius
 * @title InitBipNewSilo runs the code for the silo update.
 **/

contract InitBipNewSilo {
    AppStorage internal s;

    uint32 private constant BEAN_SEEDS_PER_BDV = 2e6;
    uint32 private constant BEAN_3CRV_SEEDS_PER_BDV = 4e6;
    uint32 private constant UNRIPE_BEAN_SEEDS_PER_BDV = 0;
    uint32 private constant UNRIPE_BEAN_3CRV_SEEDS_PER_BDV = 0;

    uint32 private constant STALK_ISSUED_PER_BDV = 10000;

    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // this adds the ERC1155 indentifier to the diamond:
        ds.supportedInterfaces[type(IERC1155).interfaceId] = true;

        // // Clear the storage variable
        // delete s.silo.deprecated_seeds;

        // set the withdrawTimer to 0:
        s.season.withdrawSeasons = 0;

        //update all silo info for current Silo-able assets

        uint32 currentSeason = s.season.current;

        s.siloSettings[C.BEAN].stalkEarnedPerSeason = BEAN_SEEDS_PER_BDV;
        s.siloSettings[C.BEAN].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.siloSettings[C.BEAN].milestoneSeason = currentSeason;
        s.siloSettings[C.BEAN].milestoneStem = 0;

        s.siloSettings[C.CURVE_BEAN_METAPOOL].stalkEarnedPerSeason = BEAN_3CRV_SEEDS_PER_BDV;
        s.siloSettings[C.CURVE_BEAN_METAPOOL].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.siloSettings[C.CURVE_BEAN_METAPOOL].milestoneSeason = currentSeason;
        s.siloSettings[C.CURVE_BEAN_METAPOOL].milestoneStem = 0;

        s.siloSettings[C.UNRIPE_BEAN].stalkEarnedPerSeason = UNRIPE_BEAN_SEEDS_PER_BDV;
        s.siloSettings[C.UNRIPE_BEAN].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.siloSettings[C.UNRIPE_BEAN].milestoneSeason = currentSeason;
        s.siloSettings[C.UNRIPE_BEAN].milestoneStem = 0;

        s.siloSettings[address(C.unripeLP())].stalkEarnedPerSeason = UNRIPE_BEAN_3CRV_SEEDS_PER_BDV;
        s.siloSettings[address(C.unripeLP())].stalkIssuedPerBdv = STALK_ISSUED_PER_BDV;
        s.siloSettings[address(C.unripeLP())].milestoneSeason = currentSeason;
        s.siloSettings[address(C.unripeLP())].milestoneStem = 0;

        //emit event for unripe LP/Beans from 4 to 1 grown stalk per bdv per season
        emit LibWhitelist.UpdatedStalkPerBdvPerSeason(
            address(C.unripeLP()),
            UNRIPE_BEAN_3CRV_SEEDS_PER_BDV,
            s.season.current
        );
        emit LibWhitelist.UpdatedStalkPerBdvPerSeason(
            address(C.unripeBean()),
            UNRIPE_BEAN_SEEDS_PER_BDV,
            s.season.current
        );

        //set the stemStartSeason to the current season
        s.season.stemStartSeason = uint16(currentSeason); //storing as uint32 to save storage space
    }
}
