/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

/**
 * @title LogicJunction
 * @author funderberker
 * @notice A Junction library that contains basic logic operations on uint256.
 **/
contract LogicJunction {
    function gt(uint256 a, uint256 b) public pure returns (bool) {
        return a > b;
    }

    function gte(uint256 a, uint256 b) public pure returns (bool) {
        return a >= b;
    }

    function lt(uint256 a, uint256 b) public pure returns (bool) {
        return a < b;
    }

    function lte(uint256 a, uint256 b) public pure returns (bool) {
        return a <= b;
    }

    function eq(uint256 a, uint256 b) public pure returns (bool) {
        return a == b;
    }

    function neq(uint256 a, uint256 b) public pure returns (bool) {
        return a != b;
    }

    function bytes32Switch(
        uint256 selector,
        bytes32[] calldata options
    ) public pure returns (bytes32) {
        return options[selector];
    }
}
