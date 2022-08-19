/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../LibMath.sol";

/**
 * @author Publius
 * @title Lib Constant Product Well
 **/
library LibConstantProductWell {

    using SafeMath for uint256;
    using LibMath for uint256;

    function getK(
        uint128[] memory xs
    ) internal pure returns (uint256 k) {
        k = uint256(xs[0]).mul(uint256(xs[1]));
        k = k.sqrt().mul(2);
    }

    function getY(
        uint256 i,
        uint128[] memory xs,
        uint256 k
    ) internal pure returns (uint256) {
        return ((k / 2) ** 2).div(xs[i]); //unchecked math is safe here.
    }

    function isWellInfoValid(
        IERC20[] calldata tokens,
        bytes calldata typeData
    ) internal pure returns (bool) {
        return tokens.length == 2 && typeData.length == 0;
    }
}
