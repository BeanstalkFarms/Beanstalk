/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../libraries/LibMath.sol";
import "../../libraries/LibSafeMath128.sol";
import "../../interfaces/IWellFunction.sol";

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
contract ConstantProduct is IWellFunction {

    using LibSafeMath128 for uint128;
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibMath for uint256;

    // D = π(x_i)^(1/n) * n
    function getD(
        bytes calldata,
        uint128[] calldata xs
    ) external override pure returns (uint256 d) {
        d = prodX(xs).nthRoot(xs.length).mul(xs.length);
    }

    // x_j = (D / n)^n / π_{i!=j}(x_i) 
    function getX(
        bytes calldata,
        uint128[] calldata xs,
        uint256 j,
        uint256 d
    ) external override pure returns (uint128 x) {
        uint256 n = xs.length;
        x = uint128((d / n) ** n); // unchecked math is safe here.
        for (uint256 i = 0; i < xs.length; ++i)
            if (i != j) x = x.div(xs[i]);
    }

    function prodX(uint128[] memory xs) private pure returns (uint256 pX) {
        pX = uint256(xs[0]);
        for (uint i = 1; i < xs.length; ++i)
            pX = pX.mul(uint256(xs[i]));
    }

    // dy = x_i/x_j
    // uses 18 decimal precision
    
    // function getdXidXj(
    //     uint256 precision,
    //     uint256 i,
    //     uint256 j,
    //     uint128[] memory xs
    // ) internal pure returns (uint256 dXi) {
    //     dXi = uint256(xs[i]).mul(precision).div(xs[j]);
    // }

    // function getdXdD(
    //     uint256 precision,
    //     uint256 i,
    //     uint128[] memory xs
    // ) internal pure returns (uint256 dX) {
    //     uint256 d = getD(xs);
    //     dX = precision.mul(xs[i]).div(d).mul(xs.length);
    // }

    // function getXAtRatio(
    //     uint128[] memory xs,
    //     uint256 i,
    //     uint256[] memory ratios
    // ) internal pure returns (uint128 x) {
    //     uint256 xTemp = prodX(xs);
    //     uint256 sumRatio = 0;
    //     for (uint _i = 0; _i < xs.length; ++_i) {
    //         if (_i != i) sumRatio = sumRatio.add(ratios[_i]);
    //     }
    //     xTemp = xTemp.mul(ratios[i]).div(sumRatio.div(xs.length-1));
    //     x = xTemp.nthRoot(xs.length).toUint128();
    // }

    // function getXDAtRatio(
    //     uint128[] memory xs,
    //     uint256 i,
    //     uint256[] memory ratios
    // ) internal pure returns (uint128 x) {
    //     uint256 xSum;
    //     for (uint j = 0; j < xs.length; ++j) {
    //         if (i != j) {
    //             xSum = xSum.add(ratios[i].mul(xs[j]).div(ratios[j]));
    //         }
    //     }
    //     x = xSum.div(xs.length-1).toUint128();
    // }
}