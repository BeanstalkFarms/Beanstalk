/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '@halborn/seraph/contracts/SeraphProtected.sol';
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibWhitelist} from "../../libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title Whitelist Facet handles the whitelisting/dewhitelisting of assets.
 **/
contract WhitelistFacet is SeraphProtected {
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint256 seeds,
        uint256 stalk
    );

    event DewhitelistToken(address indexed token);

    function dewhitelistToken(address token) external payable withSeraphPayable() {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.dewhitelistToken(token);
    }

    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalk,
        uint32 seeds
    ) external payable withSeraphPayable() {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalk,
            seeds
        );
    }
}
