/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IWellFunction.sol";

/**
 * @author Publius
 * @title LibWellFunction contains all logic to call type specific functions
 **/
library LibWellFunction {

    /**
     * Price Invariant getters
     **/


    // Swap

    function getD(
        bytes calldata wellFunction,
        uint128[] memory xs
    ) internal view returns (uint256 d) {
        address target;
        assembly {target := calldataload(sub(wellFunction.offset, 12)) }
        d = IWellFunction(target).getD(wellFunction[20:], xs);
    }

    function getX(
        bytes calldata wellFunction,
        uint128[] memory xs,
        uint256 i,
        uint256 d
    ) internal view returns (uint128 x) {
        address target;
        assembly {target := calldataload(sub(wellFunction.offset, 12)) }
        x = IWellFunction(target).getX(wellFunction[20:], xs, i, d);
    }

    // Pumps

    // function getdXidXj(
    //     bytes calldata data,
    //     uint256 precision,
    //     uint256 i,
    //     uint256 j,
    //     uint128[] memory xs
    // ) internal pure returns (uint256 dXi) {
    //     WellType wellType = getType(data);
    //     if (wellType == WellType.CONSTANT_PRODUCT)
    //         dXi = LibConstantProductWell.getdXidXj(precision, i, j, xs);
    //     else revert("LibWell: Well type not supported");
    // }

    // function getdXdD(
    //     bytes storage data,
    //     uint256 precision,
    //     uint256 i,
    //     uint128[] memory xs
    // ) internal view returns (uint256 dX) {
    //     WellType wellType = getTypeFromStorage(data);
    //     if (wellType == WellType.CONSTANT_PRODUCT)
    //         dX = LibConstantProductWell.getdXdD(precision, i, xs);
    //     else revert("LibWell: Well type not supported");
    // }

    // function getXAtRatio(
    //     bytes calldata data,
    //     uint128[] memory xs,
    //     uint256 i,
    //     uint256[] memory ratios
    // ) internal pure returns (uint128 x) {
    //     WellType wellType = getTypeFromMemory(data);
    //     if (wellType == WellType.CONSTANT_PRODUCT)
    //         x = LibConstantProductWell.getXAtRatio(xs, i, ratios);
    //     else revert("LibWell: Well type not supported");
    // }

    // function getXDAtRatio(
    //     bytes calldata data,
    //     uint128[] memory xs,
    //     uint256 i,
    //     uint256[] memory ratios
    // ) internal pure returns (uint128 x) {
    //     WellType wellType = getTypeFromMemory(data);
    //     if (wellType == WellType.CONSTANT_PRODUCT)
    //         x = LibConstantProductWell.getXDAtRatio(xs, i, ratios);
    //     else revert("LibWell: Well type not supported");
    // }
}
