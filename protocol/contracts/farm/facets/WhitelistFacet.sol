/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibWhitelist} from "../../libraries/Silo/LibWhitelist.sol";
import {AppStorage, Storage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title Whitelist Facet handles the whitelisting/dewhitelisting of assets.
 **/
contract WhitelistFacet {

    AppStorage internal s;

    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint256 seeds,
        uint256 stalk
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
        uint32 seeds,
        bool useData,
        bytes16 data
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistTokenWithData(
            token,
            selector,
            stalk,
            seeds,
            useData,
            data
        );
    }

    function getWhitelistSettings(address token)
        external
        view
        returns (Storage.SiloSettings memory ss)
    {
        ss = s.ss[token];
    }
}
