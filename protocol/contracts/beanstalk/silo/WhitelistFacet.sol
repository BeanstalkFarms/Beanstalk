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
        uint32 stalkEarnedPerSeason,
        uint256 stalk
    );
    
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
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
        uint32 stalkEarnedPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalk,
            stalkEarnedPerSeason,
            0x00
        );
    }

    function whitelistTokenWithEncodeType(
        address token,
        bytes4 selector,
        uint32 stalk,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalk,
            stalkEarnedPerSeason,
            encodeType
        );
    }

    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(
            token,
            stalkEarnedPerSeason
        );
    }
}
