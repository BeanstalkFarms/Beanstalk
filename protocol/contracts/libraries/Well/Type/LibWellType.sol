/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LibConstantProductWell.sol";
import "../LibWellStorage.sol";

/**
 * @author Publius
 * @title LibWellType contains all logic to call type specific functions
 **/
library LibWellType {

    event RegisterWellType(LibWellType.WellType wellType, string[] parameterTypes);

    // The WellType enum defines the supported Well types
    enum WellType {
        CONSTANT_PRODUCT
    }

    /**
     * Price Invariant getters
     **/


    // Swap

    function getD(
        bytes calldata data,
        uint128[] memory balances
    ) internal pure returns (uint256) {
        WellType wellType = getType(data);
        if (wellType == WellType.CONSTANT_PRODUCT)
            return LibConstantProductWell.getD(balances);
        revert("LibWell: Well type not supported");
    }

    function getX(
        bytes calldata data,
        uint256 i,
        uint128[] memory xs,
        uint256 d
    ) internal pure returns (uint128) {
        WellType wellType = getType(data);
        uint256 x;
        if (wellType == WellType.CONSTANT_PRODUCT)
            x = LibConstantProductWell.getX(i, xs, d);
        else revert("LibWell: Well type not supported");
        require(x < type(uint128).max, "LibWell: y too high");
        return uint128(x);
    }

    // Pumps

    function getdXidXj(
        bytes calldata data,
        uint256 precision,
        uint256 i,
        uint256 j,
        uint128[] memory xs
    ) internal pure returns (uint256 dXi) {
        WellType wellType = getType(data);
        if (wellType == WellType.CONSTANT_PRODUCT)
            dXi = LibConstantProductWell.getdXidXj(precision, i, j, xs);
        else revert("LibWell: Well type not supported");
    }

    function getdXdD(
        bytes storage data,
        uint256 precision,
        uint256 i,
        uint128[] memory xs
    ) internal view returns (uint256 dX) {
        WellType wellType = getTypeFromStorage(data);
        if (wellType == WellType.CONSTANT_PRODUCT)
            dX = LibConstantProductWell.getdXdD(precision, i, xs);
        else revert("LibWell: Well type not supported");
    }

    function getXAtRatio(
        bytes calldata data,
        uint128[] memory xs,
        uint256 i,
        uint256[] memory ratios
    ) internal pure returns (uint128 x) {
        WellType wellType = getTypeFromMemory(data);
        if (wellType == WellType.CONSTANT_PRODUCT)
            x = LibConstantProductWell.getXAtRatio(xs, i, ratios);
        else revert("LibWell: Well type not supported");
    }

    function getXDAtRatio(
        bytes calldata data,
        uint128[] memory xs,
        uint256 i,
        uint256[] memory ratios
    ) internal pure returns (uint128 x) {
        WellType wellType = getTypeFromMemory(data);
        if (wellType == WellType.CONSTANT_PRODUCT)
            x = LibConstantProductWell.getXDAtRatio(xs, i, ratios);
        else revert("LibWell: Well type not supported");
    }

    function getSignature(
        WellType wellType
    ) internal pure returns (string[] memory signature) {
        if (wellType == WellType.CONSTANT_PRODUCT)
            signature = LibConstantProductWell.getSignature();
        else revert("LibWell: Well type not supported");
    }

    // Internal

    function getType(
        bytes calldata data
    ) internal pure returns (WellType wt) {
        wt = WellType(uint8(data[0]));
    }

    function getTypeFromMemory(
        bytes memory data
    ) internal pure returns (WellType wt) {
        wt = WellType(uint8(data[0]));
    }

    function getTypeFromStorage(
        bytes storage data
    ) internal view returns (WellType wt) {
        wt = WellType(uint8(data[0]));
    }

    function registerIfNeeded(
        LibWellType.WellType wellType
    ) internal {
        if (!isRegistered(wellType)) register(wellType);
    }

    function register(
        LibWellType.WellType wellType
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        s.registered[wellType] = true;
        emit RegisterWellType(wellType, LibWellType.getSignature(wellType));
    }

    function isRegistered(
        LibWellType.WellType wellType
    ) internal view returns (bool registered) {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        registered = s.registered[wellType];
    }
}
