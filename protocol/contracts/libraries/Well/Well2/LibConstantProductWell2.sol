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

    function getD(
        uint128 x0,
        uint128 x1
    ) internal pure returns (uint256 d) {
        d = uint256(x0).mul(uint256(x1));
        d = d.sqrt().mul(2);
    }

    function getY(
        uint128 x,
        uint256 d
    ) internal pure returns (uint256) {
        return ((d / 2) ** 2).div(x); //unchecked math is safe here.
    }
}
