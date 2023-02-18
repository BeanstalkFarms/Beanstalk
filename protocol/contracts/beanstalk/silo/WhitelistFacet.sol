/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "~/libraries/LibDiamond.sol";
import {LibWhitelist} from "~/libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title Whitelist Facet handles the whitelisting/dewhitelisting of assets.
 **/
contract WhitelistFacet {
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkPerBdvPerSeason,
        uint256 stalk
    );
    
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkPerBdvPerSeason,
        uint32 season
    );

    event DewhitelistToken(address indexed token);

    function dewhitelistToken(address token) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.dewhitelistToken(token);
    }

    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalk,
        uint32 stalkPerBdvPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalk,
            stalkPerBdvPerSeason
        );
    }

    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkPerBdvPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(
            token,
            stalkPerBdvPerSeason
        );
    }
}
