/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "../../C.sol";
import {AppStorage, Storage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibWhitelistedTokens
 * @author Brean, Brendan
 * @notice LibWhitelistedTokens holds different lists of types of Whitelisted Tokens.
 * 
 * @dev manages the WhitelistStatuses for all tokens in the Silo in order to track lists.
 * Note: dewhitelisting a token doesn't remove it's WhitelistStatus entirely–It just modifies it.
 * Once a token has no more Deposits in the Silo, it's WhitelistStatus should be removed through calling `removeWhitelistStatus`.
 */
library LibWhitelistedTokens {


    /** 
     * @notice Emitted when a Whitelis Status is added.
     */
    event AddWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell
    );

    /**
     * @notice Emitted when a Whitelist Status is removed.
     */
    event RemoveWhitelistStatus(
        address token,
        uint256 index
    );

    /**
     * @notice Emitted when a Whitelist Status is updated.
     */
    event UpdateWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell
    );

    /**
     * @notice Returns all tokens that are currently or previously in the silo, 
     * including Unripe tokens.
     * @dev includes Dewhitelisted tokens with existing Deposits.
     */
    function getSiloTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.whitelistStatuses.length;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            tokens[i] = s.whitelistStatuses[i].token;
        }
    }

    /**
     * @notice Returns the current Whitelisted tokens, including Unripe tokens.
     */
    function getWhitelistedTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.whitelistStatuses.length;
        uint256 tokensLength;
    
        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.whitelistStatuses[i].isWhitelisted) {
                tokens[tokensLength++] = s.whitelistStatuses[i].token;
            }
        }
        assembly {
            mstore(tokens, tokensLength)
        }
    }

    /**
     * @notice Returns the current Whitelisted LP tokens. 
     * @dev Unripe LP is not an LP token.
     */
    function getWhitelistedLpTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.whitelistStatuses[i].isWhitelistedLp) {
                // assembly {
                //     mstore(tokens, add(mload(tokens), 1))
                // }
                tokens[tokensLength++] = s.whitelistStatuses[i].token;
            }
        }
        assembly {
            mstore(tokens, tokensLength)
        }
    }

    /**
     * @notice Returns the current Whitelisted Well LP tokens.
     */
    function getWhitelistedWellLpTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.whitelistStatuses[i].isWhitelistedWell) {
                tokens[tokensLength++] = s.whitelistStatuses[i].token;
            }
        }
        assembly {
            mstore(tokens, tokensLength)
        }
    }

    /**
     * @notice Returns the Whitelist statues for all tokens that have been whitelisted and not manually removed.
     */
    function getWhitelistedStatuses() internal view returns (Storage.WhitelistStatus[] memory _whitelistStatuses) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        _whitelistStatuses = s.whitelistStatuses;
    }

    /**
     * @notice Returns the Whitelist status for a given token.
     */
    function getWhitelistedStatus(address token) internal view returns (Storage.WhitelistStatus memory _whitelistStatus) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 tokenStatusIndex = findWhitelistStatusIndex(token);
        _whitelistStatus = s.whitelistStatuses[tokenStatusIndex];
    }

    /**
     * @notice Adds a Whitelist Status for a given `token`.
     */
    function addWhitelistStatus(address token, bool isWhitelisted, bool isWhitelistedLp, bool isWhitelistedWell) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.whitelistStatuses.push(Storage.WhitelistStatus(
            token,
            isWhitelisted,
            isWhitelistedLp,
            isWhitelistedWell
        ));

        emit AddWhitelistStatus(token, s.whitelistStatuses.length - 1, isWhitelisted, isWhitelistedLp, isWhitelistedWell);
    }

    /**
     * @notice Modifies the exisiting Whitelist Status of `token`.
     */
    function updateWhitelistStatus(address token, bool isWhitelisted, bool isWhitelistedLp, bool isWhitelistedWell) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 tokenStatusIndex = findWhitelistStatusIndex(token);
        s.whitelistStatuses[tokenStatusIndex].isWhitelisted = isWhitelisted;
        s.whitelistStatuses[tokenStatusIndex].isWhitelistedLp = isWhitelistedLp;
        s.whitelistStatuses[tokenStatusIndex].isWhitelistedWell = isWhitelistedWell;

        emit UpdateWhitelistStatus(
            token,
            tokenStatusIndex,
            isWhitelisted,
            isWhitelistedLp,
            isWhitelistedWell
        );
    }

    /**
     * @notice Removes `token`'s Whitelist Status.
     */
    function removeWhitelistStatus(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 tokenStatusIndex = findWhitelistStatusIndex(token);
        s.whitelistStatuses[tokenStatusIndex] = s.whitelistStatuses[s.whitelistStatuses.length - 1];
        s.whitelistStatuses.pop();

        emit RemoveWhitelistStatus(token, tokenStatusIndex);
    }

    /**
     * @notice Finds the index of a given `token`'s Whitelist Status.
     */
    function findWhitelistStatusIndex(address token) private view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 whitelistedStatusLength = s.whitelistStatuses.length;
        uint256 i;
        while (s.whitelistStatuses[i].token != token) {
            i++;
            if (i >= whitelistedStatusLength) {
                revert("LibWhitelistedTokens: Token not found");
            }
        }
        return i;
    }
}
