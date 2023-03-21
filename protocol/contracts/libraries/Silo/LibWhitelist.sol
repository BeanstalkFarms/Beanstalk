/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../LibAppStorage.sol";
import "~/libraries/Silo/LibTokenSilo.sol";

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
     * @notice Emitted when the stalk per bdv per season for a Silo token is updated.
     * @param token ERC-20 token being updated in the Silo Whitelist.
     * @param stalkEarnedPerSeason new stalk per bdv per season value for this token.
     * @param season the current season.
     */
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
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
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.ss[token].selector = selector;
        s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv; //previously just called "stalk"
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason; //previously called "seeds"

        s.ss[token].milestoneSeason = s.season.current;

        emit WhitelistToken(token, selector, stalkEarnedPerSeason, stalkIssuedPerBdv);
    }
    
    /**
     * @dev Update the stalk per bdv per season for a token.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.ss[token].milestoneStem = LibTokenSilo.stemTipForToken(IERC20(token)); //store grown stalk milestone
        s.ss[token].milestoneSeason = s.season.current; //update milestone season as this season
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason;

        emit UpdatedStalkPerBdvPerSeason(token, stalkEarnedPerSeason, s.season.current);
    }


    //function not needed because we'll manually setup these initial values from the bip script?
    //however it's referenced in the InitWhitelist.sol code
    function whitelistTokenLegacy(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.ss[token].selector = selector;
        s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv; //previously just called "stalk"
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason; //previously called "seeds"

        s.ss[token].milestoneSeason = s.season.current;

        emit WhitelistToken(token, selector, stalkEarnedPerSeason, stalkIssuedPerBdv);
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
