/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

/**
 * @title MathJunction
 * @author funderberker
 * @notice A Junction library that enables basic safe math functionality for blueprint encoded calls.
 **/
contract MathJunction {

    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b;
    }

    function sub(uint256 a, uint256 b) public pure returns (uint256) {
        return a - b;
    }

    function mul(uint256 a, uint256 b) public pure returns (uint256) {
        return a * b;
    }

    function div(uint256 a, uint256 b) public pure returns (uint256) {
        return a / b;
    }

    function mod(uint256 a, uint256 b) public pure returns (uint256) {
        return a % b;
    }

    function mulDiv(uint256 a, uint256 b, uint256 c) public pure returns (uint256) {
        return a * b / c;
    }
}
