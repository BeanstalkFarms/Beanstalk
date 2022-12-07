/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Well Function Interface
**/
interface IWellFunction {
    function getX(
        bytes calldata data,
        uint128[] memory xs,
        uint256 i,
        uint256 d
    ) external view returns (uint128 x);

    function getD(
        bytes calldata data,
        uint128[] memory xs
    ) external view returns (uint256 d);
}