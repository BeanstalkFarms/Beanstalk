/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../LibMath.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Library for Constant Product Wells
 * Constant Product Wells use the formula:
 * π(x_i) = (D / n)^n
 * Where
 * x_i are the balances in the pool
 * n is the number of tokens in the pool
 * D is the value weighted number of tokens in the pool
 **/
library LibConstantProductWell {

    using SafeMath for uint256;
    using LibMath for uint256;

    // D = π(x_i)^(1/n) * n
    function getD(
        uint128[] memory xs
    ) internal pure returns (uint256 d) {
        d = uint256(xs[0]);
        uint256 n = xs.length;
        for (uint i = 1; i < xs.length; ++i)
            d = d.mul(uint256(xs[i]));
        d = d.nthRoot(n).mul(n);
    }

    // x_j = (D / n)^n / π_{i!=j}(x_i) 
    function getX(
        uint256 j,
        uint128[] memory xs,
        uint256 d
    ) internal pure returns (uint256 x) {
        uint256 n = xs.length;
        x = ((d / n) ** n); // unchecked math is safe here.
        for (uint256 i = 0; i < xs.length; ++i)
            if (i != j) x = x.div(xs[i]);
    }

    // dy = x_i/x_j
    // uses 18 decimal precision
    function getdXidXj(
        uint256 precision,
        uint256 i,
        uint256 j,
        uint128[] memory xs
    ) internal pure returns (uint256 dXi) {
        dXi = uint256(xs[i]).mul(precision).div(xs[j]);
    }

    function getdXdD(
        uint256 precision,
        uint256 i,
        uint128[] memory xs
    ) internal pure returns (uint256 dX) {
        uint256 d = getD(xs);
        dX = precision.mul(xs[i]).div(d).mul(xs.length);
    }

    function deltaX(
        uint256 dXidXj,
        uint128[] memory xs,
        uint256 i,
        uint256 j
    ) internal pure returns (int256 dX) {
        uint256 d;
        if (xs.length == 2) {
            d = getD(xs);
        } else {
            uint128[] memory _xs = new uint128[](2);
            _xs[0] = xs[i]; _xs[1] = xs[j];
            d = getD(_xs);
        }
        uint256 targetX = d.mul(1e18).div(dXidXj).nthRoot(xs.length);
        dX = int256(targetX - xs[i]);
    }

    // function deltaD(
    //     uint256 dXidXj,
    //     uint128[] memory xs,
    //     uint256 i,
    //     uint256 j
    // ) internal pure returns (int256 dD) {
    //     uint256 d = getD(xs);
    //     xs[i] = xs[j].mul(dXidXj).div(1e18);
    //     uint256 d2 = getD(xs);
    //     dD = int256(d2 - d);
    // }

    // function deltaDX(
    //     uint256 dXidXj,
    //     uint128[] memory xs,
    //     uint256 i,
    //     uint256 j
    // ) internal pure returns (int256 dDX) {
    // }

    function getSignature() internal pure returns (string[] memory signature) {
        return signature;
    }
}