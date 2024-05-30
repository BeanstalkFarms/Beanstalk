/*
 SPDX-License-Identifier: MIT
*/

import {C} from "contracts/C.sol";
pragma solidity ^0.8.20;

contract MockChainlinkPriceFeedRegistry {
    function getFeed(address base, address quote) external pure returns (address aggregator) {
        if (
            base == address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599) &&
            quote == address(0x0000000000000000000000000000000000000348)
        ) {
            // wbtc/usd
            return address(0xd0C7101eACbB49F3deCcCc166d238410D6D46d57);
        }

        if (
            base == address(C.USDC) && quote == address(0x0000000000000000000000000000000000000348)
        ) {
            // usdc/usd
            return address(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);
        }
    }
}
