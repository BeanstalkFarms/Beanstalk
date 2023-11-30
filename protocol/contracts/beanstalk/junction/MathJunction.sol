/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title MathJunction
 * @author funderberker
 * @notice A Junction library that enables basic safe math functionality for blueprint encoded calls. Wraps SafeMath.
 * @dev Will be called from FarmFacet. Has access to Beanstalk state (delegatecall).
 * @dev Deviates from Beanstalk lib standard by using external functions. This provides a known callable selector.
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

    // function add(uint256 a, uint256 b) external pure returns (uint256) {
    //     return a + b;
    // }

    // function sub(uint256 a, uint256 b) external pure returns (uint256) {
    //     return a - b;
    // }

    // function mul(uint256 a, uint256 b) external pure returns (uint256) {
    //     return a * b;
    // }

    // function div(uint256 a, uint256 b) external pure returns (uint256) {
    //     return a / b;
    // }

    // function mod(uint256 a, uint256 b) external pure returns (uint256) {
    //     return a % b;
    // }

    // function mulDiv(uint256 a, uint256 b, uint256 c) external pure returns (uint256) {
    //     return (a * b) / c;
    // }
}
