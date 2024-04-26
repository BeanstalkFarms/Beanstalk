/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Brean
 * @title Non chainlink Mock Oracle implmentation.
 * @notice Contains a valid and invalid price implmentation.
 **/
contract MockOracle {

    uint256 public price;
    uint256 public twaPrice;

    constructor(uint256 _price, uint256 _twaPrice) {
        price = _price;
        twaPrice = _twaPrice;
    }

    /**
     * @notice Valid Implmentation.
     */
    function getPrice(uint256 lookback) public view returns (uint256) {
        if(lookback > 0) {
            return twaPrice;
        } else {
            return price;
        }
    }

    /**
     * @notice Invalid due to changing state.
     */
    function invalidGetPrice(uint256 lookback) external returns (uint256) {
        twaPrice = twaPrice;
        price = price;
        return getPrice(lookback);
    }

    /**
     * @notice Invalid due to different input parameters.
     */
    function invalidGetPrice2(uint256 lookback, uint256 param2) external returns (uint256) {
        twaPrice = twaPrice;
        price = price;
        return getPrice(lookback + param2);
    }
}