/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @title LibWhitelist
 * @author Publius
 * @notice Handles adding and removing ERC-20 tokens from the Silo Whitelist.
 */
library LibWhitelist {

    /**
     * @notice Emitted when a token is added to the Silo Whitelist.
     * @param token ERC-20 token being added to the Silo Whitelist.
     * @param selector The function selector that returns the BDV of a given
     * amount of `token`. Must have signature:
     * 
     * ```
     * function bdv(uint256 amount) public view returns (uint256);
     * ```
     * 
     * @param stalkPerBdvPerSeason The Stalk per BDV per Season received from depositing `token`.
     * @param stalk The Stalk per BDV received from depositing `token`.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkPerBdvPerSeason,
        uint256 stalk
    );

    /**
     * @notice Emitted when a token is removed from the Silo Whitelist.
     * @param token ERC-20 token being removed from the Silo Whitelist.
     */
    event DewhitelistToken(address indexed token);

    /**
     * @dev Add an ERC-20 token to the Silo Whitelist.
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkPerBdv,
        uint32 stalkPerBdvPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.ss[token].selector = selector;
        s.ss[token].stalkPerBdv = stalkPerBdv; //previously just called "stalk"
        s.ss[token].stalkPerBdvPerSeason = stalkPerBdvPerSeason; //previously called "seeds"

        emit WhitelistToken(token, selector, stalkPerBdv, stalkPerBdvPerSeason);
    }


    /**
     * @dev Remove an ERC-20 token from the Silo Whitelist.
     */
    function dewhitelistToken(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        delete s.ss[token];

        emit DewhitelistToken(token);
    }
}
