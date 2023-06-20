/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibEthUsdOracle} from "./LibEthUsdOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {C} from "contracts/C.sol";

/**
 * @title Eth Usd Oracle Library
 * @notice Contains functionalty to fetch the manipulation resistant USD price of different tokens.
 * @dev currently supports:
 * - ETH/USD price
 **/
library LibUsdOracle {

    using SafeMath for uint256;

    uint256 constant MAX_DIFFERENCE = 105;
    uint256 constant DIFFERENCE_DENOMINATOR = 100;

    /**
     * Returns the price of a given token in in USD.
     */
    function getUsdPrice(address token) internal view returns (uint256) {
        if (token == C.WETH) {
            uint256 ethUsdPrice = LibEthUsdOracle.getEthUsdPrice();
            require(ethUsdPrice > 0, "Oracle: Failed");
            return uint256(1e24).div(LibEthUsdOracle.getEthUsdPrice());
        }
        revert("Oracle: Token not supported.");
    }

}
