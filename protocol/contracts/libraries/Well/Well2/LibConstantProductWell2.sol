/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../LibMath.sol";

/**
 * @author Publius
 * @title Library for Constant Product Wells with 2 tokens
 **/
library LibConstantProductWell2 {

    using SafeMath for uint256;
    using LibMath for uint256;

    function getK(
        uint128 x0,
        uint128 x1
    ) internal pure returns (uint256 k) {
        k = uint256(x0).mul(uint256(x1));
        k = k.sqrt().mul(2);
    }

    function getY(
        uint128 x,
        uint256 k
    ) internal pure returns (uint256) {
        return ((k / 2) ** 2).div(x); //unchecked math is safe here.
    }
}
