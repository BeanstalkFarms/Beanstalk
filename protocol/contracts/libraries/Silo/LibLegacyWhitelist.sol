/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "../../C.sol";
import "../LibAppStorage.sol";
import "contracts/libraries/Silo/LibTokenSilo.sol";

/**
 * @title LibLegacyWhitelist
 * @author Publius
 * @notice Handles adding and removing ERC-20 tokens from the Legacy Silo Whitelist.
 */
library LibLegacyWhitelist {
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
     * @param stalkEarnedPerSeason The Stalk per BDV per Season received from depositing `token`.
     * @param stalk The Stalk per BDV received from depositing `token`.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalk
    );

    /**
     * @dev Add an ERC-20 token to the Silo Whitelist.
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.sys.silo.assetSettings[token].selector = selector;
        s.sys.silo.assetSettings[token].stalkIssuedPerBdv = stalkIssuedPerBdv; //previously just called "stalk"
        s.sys.silo.assetSettings[token].stalkEarnedPerSeason = stalkEarnedPerSeason; //previously called "seeds"

        s.sys.silo.assetSettings[token].milestoneSeason = s.sys.season.current;

        emit WhitelistToken(token, selector, stalkEarnedPerSeason, stalkIssuedPerBdv);
    }
}
