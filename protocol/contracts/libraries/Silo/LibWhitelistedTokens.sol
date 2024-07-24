/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "../../C.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {WhitelistStatus} from "contracts/beanstalk/storage/System.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";

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
        bool isWhitelistedWell,
        bool isSoppable
    );

    /**
     * @notice Emitted when a Whitelist Status is removed.
     */
    event RemoveWhitelistStatus(address token, uint256 index);

    /**
     * @notice Emitted when a Whitelist Status is updated.
     */
    event UpdateWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    );

    /**
     * @notice Returns all tokens that are currently or previously in the silo,
     * including Unripe tokens.
     * @dev includes Dewhitelisted tokens with existing Deposits.
     */
    function getSiloTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.sys.silo.whitelistStatuses.length;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            tokens[i] = s.sys.silo.whitelistStatuses[i].token;
        }
    }

    /**
     * @notice Returns the current Whitelisted tokens, including Unripe tokens.
     */
    function getWhitelistedTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.sys.silo.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.sys.silo.whitelistStatuses[i].isWhitelisted) {
                tokens[tokensLength++] = s.sys.silo.whitelistStatuses[i].token;
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
        uint256 numberOfSiloTokens = s.sys.silo.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.sys.silo.whitelistStatuses[i].isWhitelistedLp) {
                // assembly {
                //     mstore(tokens, add(mload(tokens), 1))
                // }
                tokens[tokensLength++] = s.sys.silo.whitelistStatuses[i].token;
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
        uint256 numberOfSiloTokens = s.sys.silo.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.sys.silo.whitelistStatuses[i].isWhitelistedWell) {
                tokens[tokensLength++] = s.sys.silo.whitelistStatuses[i].token;
            }
        }
        assembly {
            mstore(tokens, tokensLength)
        }
    }

    /**
     * @notice Returns all tokens that are currently or previously soppable.
     * Reviewer note: maybe need a better name for this function? Necessary if a sop happens for a well and it becomes de-whitelisted.
     */
    function getSoppableWellLpTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.sys.silo.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (s.sys.silo.whitelistStatuses[i].isSoppable) {
                tokens[tokensLength++] = s.sys.silo.whitelistStatuses[i].token;
            }
        }
        assembly {
            mstore(tokens, tokensLength)
        }
    }

    function getSopTokens() internal view returns (address[] memory) {
        address[] memory tokens = getSoppableWellLpTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            tokens[i] = address(LibWell.getNonBeanTokenFromWell(tokens[i]));
        }
        return tokens;
    }

    /**
     * @notice Returns all tokens that are currently soppable.
     */
    function getCurrentlySoppableWellLpTokens() internal view returns (address[] memory tokens) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 numberOfSiloTokens = s.sys.silo.whitelistStatuses.length;
        uint256 tokensLength;

        tokens = new address[](numberOfSiloTokens);

        for (uint256 i = 0; i < numberOfSiloTokens; i++) {
            if (
                s.sys.silo.whitelistStatuses[i].isWhitelistedWell &&
                s.sys.silo.whitelistStatuses[i].isSoppable
            ) {
                tokens[tokensLength++] = s.sys.silo.whitelistStatuses[i].token;
            }
        }
        assembly {
            mstore(tokens, tokensLength)
        }
    }

    /**
     * @notice Returns the Whitelist statues for all tokens that have been whitelisted and not manually removed.
     */
    function getWhitelistedStatuses()
        internal
        view
        returns (WhitelistStatus[] memory _whitelistStatuses)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        _whitelistStatuses = s.sys.silo.whitelistStatuses;
    }

    /**
     * @notice Returns the Whitelist status for a given token.
     */
    function getWhitelistedStatus(
        address token
    ) internal view returns (WhitelistStatus memory _whitelistStatus) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 tokenStatusIndex = findWhitelistStatusIndex(token);
        _whitelistStatus = s.sys.silo.whitelistStatuses[tokenStatusIndex];
    }

    /**
     * @notice Adds a Whitelist Status for a given `token`.
     */
    function addWhitelistStatus(
        address token,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.silo.whitelistStatuses.push(
            WhitelistStatus(token, isWhitelisted, isWhitelistedLp, isWhitelistedWell, isSoppable)
        );

        emit AddWhitelistStatus(
            token,
            s.sys.silo.whitelistStatuses.length - 1,
            isWhitelisted,
            isWhitelistedLp,
            isWhitelistedWell,
            isSoppable
        );
    }

    /**
     * @notice Modifies the exisiting Whitelist Status of `token`.
     */
    function updateWhitelistStatus(
        address token,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 tokenStatusIndex = findWhitelistStatusIndex(token);

        s.sys.silo.whitelistStatuses[tokenStatusIndex].isWhitelisted = isWhitelisted;
        s.sys.silo.whitelistStatuses[tokenStatusIndex].isWhitelistedLp = isWhitelistedLp;
        s.sys.silo.whitelistStatuses[tokenStatusIndex].isWhitelistedWell = isWhitelistedWell;
        s.sys.silo.whitelistStatuses[tokenStatusIndex].isSoppable = isSoppable;

        emit UpdateWhitelistStatus(
            token,
            tokenStatusIndex,
            isWhitelisted,
            isWhitelistedLp,
            isWhitelistedWell,
            isSoppable
        );
    }

    /**
     * @notice Removes `token`'s Whitelist Status.
     */
    function removeWhitelistStatus(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 tokenStatusIndex = findWhitelistStatusIndex(token);
        s.sys.silo.whitelistStatuses[tokenStatusIndex] = s.sys.silo.whitelistStatuses[
            s.sys.silo.whitelistStatuses.length - 1
        ];
        s.sys.silo.whitelistStatuses.pop();

        emit RemoveWhitelistStatus(token, tokenStatusIndex);
    }

    /**
     * @notice Finds the index of a given `token`'s Whitelist Status.
     */
    function findWhitelistStatusIndex(address token) private view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 whitelistedStatusLength = s.sys.silo.whitelistStatuses.length;
        uint256 i;
        while (s.sys.silo.whitelistStatuses[i].token != token) {
            i++;
            if (i >= whitelistedStatusLength) {
                revert("LibWhitelistedTokens: Token not found");
            }
        }
        return i;
    }

    /**
     * @notice checks if a token is whitelisted.
     * @dev checks whether a token is in the whitelistStatuses array. If it is,
     * verify whether `isWhitelisted` is set to false.
     * @param token the token to check.
     */
    function checkWhitelisted(
        address token
    ) internal view returns (bool isWhitelisted, bool previouslyWhitelisted) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 whitelistedStatusLength = s.sys.silo.whitelistStatuses.length;
        uint256 i;
        while (s.sys.silo.whitelistStatuses[i].token != token) {
            i++;
            if (i >= whitelistedStatusLength) {
                // if the token does not appear in the array
                // it has not been whitelisted nor dewhitelisted.
                return (false, false);
            }
        }

        if (s.sys.silo.whitelistStatuses[i].isWhitelisted) {
            // token is whitelisted.
            return (true, false);
        } else {
            // token has been whitelisted previously.
            return (false, true);
        }
    }

    function getIndexFromWhitelistedWellLpTokens(address token) internal view returns (uint256) {
        address[] memory whitelistedWellLpTokens = getWhitelistedWellLpTokens();
        for (uint256 i; i < whitelistedWellLpTokens.length; i++) {
            if (whitelistedWellLpTokens[i] == token) {
                return i;
            }
        }

        revert("LibWhitelistedTokens: Token not found");
    }
}
