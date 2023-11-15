/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
/**
 * @title Curve Oracle Library
 * @author brendan
 * @notice Contains functionalty to read prices from Curve pools.
 * @dev currently supports:
 * - stETH:ETH
 **/
library LibCurveOracle {

    address constant STETH_ETH_CURVE_POOL = 0xDC24316b9AE028F1497c275EB9192a3Ea0f67022;

    function getStethEthPrice() internal {


    }
}
