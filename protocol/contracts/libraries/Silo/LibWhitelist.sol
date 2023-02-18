/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../LibAppStorage.sol";
import "hardhat/console.sol";

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
     * @notice Emitted when the stalk per bdv per season for a Silo token is updated.
     * @param token ERC-20 token being updated in the Silo Whitelist.
     * @param stalkPerBdvPerSeason new stalk per bdv per season value for this token.
     * @param season the current season.
     */
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkPerBdvPerSeason,
        uint32 season
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

        s.ss[token].lastUpdateSeason = C.siloV3StartSeason(); //TODOSEEDS hydrate as current season?

        emit WhitelistToken(token, selector, stalkPerBdvPerSeason, stalkPerBdv);
    }
    
    /**
     * @dev Add an ERC-20 token to the Silo Whitelist.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkPerBdvPerSeason
        ) internal {

        AppStorage storage s = LibAppStorage.diamondStorage();
        s.ss[token].stalkPerBdvPerSeason = stalkPerBdvPerSeason;

        emit UpdatedStalkPerBdvPerSeason(token, stalkPerBdvPerSeason, s.season.current);
    }

    function whitelistTokenLegacy(
        address token,
        bytes4 selector,
        uint32 stalkPerBdv,
        uint32 stalkPerBdvPerSeason,
        uint32 seeds
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.ss[token].selector = selector;
        s.ss[token].stalkPerBdv = stalkPerBdv; //previously just called "stalk"
        s.ss[token].stalkPerBdvPerSeason = stalkPerBdvPerSeason; //previously called "seeds"
        s.ss[token].legacySeedsPerBdv = seeds;

        s.ss[token].lastUpdateSeason = C.siloV3StartSeason(); //hydrate as the constant season when we flip over 

        console.log('seeds: ', seeds, ' for ', token);

        emit WhitelistToken(token, selector, stalkPerBdvPerSeason, stalkPerBdv);
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
