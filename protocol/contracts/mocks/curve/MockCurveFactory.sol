/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IBean.sol";
import "../MockToken.sol";

/**
 * @author Publius, LeoFib
 * @title MockCurveFactory
**/

interface I3Curve {
    function get_virtual_price() external view returns (uint256);
}

contract MockCurveFactory {

    mapping(address => address[4]) internal coins;

    mapping(address => address[8]) internal underlying_coins;

    function set_coins(address _pool, address[4] calldata _coins) external {
        coins[_pool] =_coins;

    }

    function set_underlying_coins(address _pool, address[8] calldata _underlying_coins) external {
        underlying_coins[_pool] = _underlying_coins;
    }

    function get_coins(address _pool) external view returns (address[4] memory _coins) {
        return coins[_pool];

    }
    function get_underlying_coins(address _pool) external view returns (address[8] memory _underlying_coins) {
        return underlying_coins[_pool];
    }
}