/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title MathJunction
 * @author funderberker
 * @notice A Junction library that enables basic safe math functionality for blueprint encoded calls. Wraps SafeMath.
 **/
contract MathJunction {
    using SafeMath for uint256;

    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a.add(b);
    }

    function sub(uint256 a, uint256 b) public pure returns (uint256) {
        return a.sub(b);
    }

    function mul(uint256 a, uint256 b) public pure returns (uint256) {
        return a.mul(b);
    }

    function div(uint256 a, uint256 b) public pure returns (uint256) {
        return a.div(b);
    }

    function mod(uint256 a, uint256 b) public pure returns (uint256) {
        return a.mod(b);
    }

    function mulDiv(uint256 a, uint256 b, uint256 c) public pure returns (uint256) {
        return a.mul(b).div(c);
    }
}
