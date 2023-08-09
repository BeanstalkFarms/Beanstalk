/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {C} from "contracts/C.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";



/**
 * @author Publius
 * @title InitBipWellsIntegration runs the code for the Basin Integration
**/

interface IBDVFacet {
    function wellBdv(address token, uint256 amount)
        external
        view
        returns (uint256);
}

contract InitBipBasinIntegration {

    AppStorage internal s;

    uint32 constant private NEW_BEAN_SEEDS_PER_BDV = 3e6;
    uint32 constant private NEW_BEAN_3CRV_SEEDS_PER_BDV = 3.25e6;
    uint32 constant private BEAN_ETH_SEEDS_PER_BDV = 4.5e6;

    uint32 constant private STALK_ISSUED_PER_BDV = 10000;
    
    
    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        LibWhitelist.updateStalkPerBdvPerSeasonForToken(C.BEAN, NEW_BEAN_SEEDS_PER_BDV);
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(C.CURVE_BEAN_METAPOOL, NEW_BEAN_3CRV_SEEDS_PER_BDV);
        LibWhitelist.whitelistToken(
            C.BEAN_ETH_WELL,
            IBDVFacet.wellBdv.selector,
            STALK_ISSUED_PER_BDV,
            BEAN_ETH_SEEDS_PER_BDV,
            0x01
        );

        s.beanEthPrice = 1;

        // adds ERC1155MetadataURI for ERC165 Interface ID
        ds.supportedInterfaces[0x0e89341c] = true;
    }
}