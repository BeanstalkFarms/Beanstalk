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

    function getD(
        WellType wellType,
        bytes memory typeData,
        uint128[] memory balances
    ) internal pure returns (uint256) {
        if (wellType == WellType.CONSTANT_PRODUCT)
            return LibConstantProductWell.getD(balances);
        revert("LibWell: Well type not supported");
    }

    function getX(
        WellType wellType,
        bytes calldata typeData,
        uint256 i,
        uint128[] memory xs,
        uint256 d
    ) internal pure returns (uint128) {
        uint256 x;
        if (wellType == WellType.CONSTANT_PRODUCT)
            x = LibConstantProductWell.getX(i, xs, d);
        else revert("LibWell: Well type not supported");
        require(x < type(uint128).max, "LibWell: y too high");
        return uint128(x);
    }
    
    function getdXidXj(
        WellType wellType,
        bytes calldata typeData,
        uint256 i,
        uint256 j,
        uint128[] memory xs
    ) internal pure returns (uint256 dXi) {
        if (wellType == WellType.CONSTANT_PRODUCT)
            dXi = LibConstantProductWell.getdXidXj(i, j, xs);
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

    function getTypeAndData(
        address wellId
    ) internal view returns (WellType wellType, bytes memory data) {
        LibWellStorage.WellInfo storage wi = LibWellStorage.wellInfo(wellId);
        wellType = wi.wellType;
        if (getSignature((wellType)).length > 0) data = wi.typeData;
    }


    function registerIfNeeded(
        LibWellType.WellType wellType
    ) internal {
        if (!registered(wellType)) register(wellType);
    }

    function register(
        LibWellType.WellType wellType
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        s.registered[wellType] = true;
        emit RegisterWellType(wellType, LibWellType.getSignature(wellType));
    }

    function registered(
        LibWellType.WellType wellType
    ) internal view returns (bool registered) {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        registered = s.registered[wellType];
    }
}
