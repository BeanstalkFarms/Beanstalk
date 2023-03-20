/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @author Publius
 * @title Oracle fetches the usd price of a given token
 **/


library LibUsdOracle {

    function getUsdPrice(address token) internal view returns (uint256) {
        // TODO: implement oracle.
        return 1e15;
    }
}
