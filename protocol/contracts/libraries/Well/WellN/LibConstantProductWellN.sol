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
 * @title Library for Constant Product Wells with more than 2 tokens
 **/
library LibConstantProductWellN {

    using SafeMath for uint256;
    using LibMath for uint256;

    function getK(
        uint128[] memory xs
    ) internal pure returns (uint256 k) {
        k = uint256(xs[0]);
        uint256 n = xs.length;
        for (uint i = 1; i < xs.length; i++)
            k = k.mul(uint256(xs[i]));
        k = k.nthRoot(n).mul(n);
    }

    function getY(
        uint256 i,
        uint128[] memory xs,
        uint256 k
    ) internal pure returns (uint256 x) {
        uint256 n = xs.length;
        x = ((k / n) ** n); // unchecked math is safe here.
        for (uint256 _i = 0; _i < xs.length; _i++)
            if (_i != i) x = x.div(xs[_i]);
    }
}
