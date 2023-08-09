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

    /**
     * @dev Returns the price of a given token in in USD.
     */
    function getUsdPrice(address token) internal view returns (uint256) {
        if (token == C.WETH) {
            uint256 ethUsdPrice = LibEthUsdOracle.getEthUsdPrice();
            if (ethUsdPrice == 0) return 0;
            return uint256(1e24).div(ethUsdPrice);
        }
        revert("Oracle: Token not supported.");
    }

}
