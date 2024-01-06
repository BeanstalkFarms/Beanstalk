/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "../../C.sol";

/**
 * @title LibWhitelistedTokens
 * @author Brean
 * @notice LibWhitelistedTokens returns the current Whitelisted tokens.
 * @dev a library is used, rather than keeping the addresses in storages,
 * as a gas optimization.
 * 
 * This library should be updated when new tokens are added to silo.
 */
library LibWhitelistedTokens {
    /**
     * @notice Returns all tokens that are currently or previously in the silo, 
     * including Unripe tokens.
     */
    function getSiloTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](5);
        tokens[0] = C.BEAN;
        tokens[1] = C.BEAN_ETH_WELL;
        tokens[2] = C.CURVE_BEAN_METAPOOL;
        tokens[3] = C.UNRIPE_BEAN;
        tokens[4] = C.UNRIPE_LP;
    }

    /**
     * @notice Returns the current Whitelisted tokens, including Unripe tokens.
     */
    function getWhitelistedTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](4);
        tokens[0] = C.BEAN;
        tokens[1] = C.BEAN_ETH_WELL;
        tokens[2] = C.UNRIPE_BEAN;
        tokens[3] = C.UNRIPE_LP;
    }

    /**
     * @notice Returns the current Whitelisted LP tokens. 
     * @dev Unripe LP is not an LP token.
     */
    function getWhitelistedLpTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](1);
        tokens[0] = C.BEAN_ETH_WELL;
    }

    /**
     * @notice Returns the list of Whitelisted Well LP tokens.
     */
    function getWhitelistedWellLpTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](1);
        tokens[0] = C.BEAN_ETH_WELL;
    }
}
