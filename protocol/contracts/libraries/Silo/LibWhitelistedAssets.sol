/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

/**
 * @title LibWhitelistedAssets
 * @author Brean
 * @notice LibWhitelistedAssets returns the current whitelisted assets in a gas-efficient manner.
 */
library LibWhitelistedAssets {

    /**
     * @notice Returns the current whitelisted assets.
     */
    function getWhitelistedAssets() internal pure returns (address[] memory assets) {
        assets = new address[](4);
        assets[0] = C.BEAN;
        assets[1] = C.BEAN_ETH_WELL;
        assets[2] = C.UNRIPE_BEAN;
        assets[3] = C.UNRIPE_LP;
    }

    function getWhitelistedLPAssets() internal pure returns (address[] memory assets) {
        assets = new address[](2);
        assets[1] = C.BEAN_ETH_WELL;
        assets[3] = C.UNRIPE_LP;
    }
}
