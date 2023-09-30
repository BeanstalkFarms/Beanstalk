/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

/**
 * @title LibWhitelistedTokens
 * @author Brean
 * @notice LibWhitelistedTokens returns the current whitelisted assets.
 */
library LibWhitelistedTokens {

    /**
     * @notice Returns the current whitelisted assets.
     */
    function getSiloTokens() internal pure returns (address[] memory assets) {
        assets = new address[](3);
        assets[0] = C.BEAN;
        assets[1] = C.BEAN_ETH_WELL;
        assets[2] = C.CURVE_BEAN_METAPOOL;
    }

    /**
     * @notice Returns the current whitelisted assets.
     */
    function getSiloTokensWithUnripe() internal pure returns (address[] memory assets) {
        assets = new address[](5);
        assets[0] = C.BEAN;
        assets[1] = C.BEAN_ETH_WELL;
        assets[2] = C.CURVE_BEAN_METAPOOL;
        assets[3] = C.UNRIPE_BEAN;
        assets[4] = C.UNRIPE_LP;
    }

    /**
     * @notice Returns the current whitelisted LP assets.
     */
    function getSiloLPTokens() internal pure returns (address[] memory assets) {
        assets = new address[](2);
        assets[0] = C.BEAN_ETH_WELL;
        assets[1] = C.CURVE_BEAN_METAPOOL;
    }
}
