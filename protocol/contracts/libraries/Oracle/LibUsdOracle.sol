/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibEthUsdOracle} from "./LibEthUsdOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @author Publius
 * @title Oracle fetches the usd price of a given token
 **/

import {console} from "hardhat/console.sol";

library LibUsdOracle {

    using SafeMath for uint256;

    uint256 constant MAX_DIFFERENCE = 105;
    uint256 constant DIFFERENCE_DENOMINATOR = 100;

    function getUsdPrice(address token) internal view returns (uint256) {
        // if (token == C.WETH) {
        //     return LibEthUsdOracle.getEthUsdPrice();
        // }
        // TODO: implement oracle.
        return 1e15;
    }

}
