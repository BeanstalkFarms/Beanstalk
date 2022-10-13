/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Type/LibWellType.sol";

/**
 * @author Publius
 * @title Lib Well Oracle
 **/
library LibWellData {

    // Get Type

    function getType(
        bytes calldata data
    ) internal pure returns (LibWellType.WellType wt) {
        wt = LibWellType.WellType(uint8(data[0]));
    }

    function getType(
        bytes storage data
    ) internal view returns (LibWellType.WellType wt) {
        wt = LibWellType.WellType(uint8(data[0]));
    }

    // Get N

    function getN(address wellId)
        internal 
        view 
        returns (uint256 n)
    {
        n = getN(LibWellStorage.wellData(wellId));
    }

    function getN(
        bytes calldata data
    ) internal pure returns (uint256 n) {
        n = uint256(uint8(data[1]));
    }

    function getN1(
        bytes memory data
    ) internal pure returns (uint256 n) {
        n = uint256(uint8(data[1]));
    }

    function getN(
        bytes storage data
    ) internal view returns (uint256 n) {
        n = uint256(uint8(data[1]));
    }

    // Get N

    function getDecimals(
        address wellId
    ) internal view returns (uint8[] memory decimals) {
        decimals = getDecimals(LibWellStorage.wellData(wellId));
    }

    function getDecimals(
        bytes calldata data
    ) internal pure returns (uint8[] memory decimals) {
        uint256 n = getN(data);
        decimals = new uint8[](n);
        for (uint256 i = 0; i < n; ++i) {
            decimals[i] = uint8(data[i+2]);
        }
    }

    function getDecimals1(
        bytes memory data
    ) internal pure returns (uint8[] memory decimals) {
        uint256 n = getN1(data);
        decimals = new uint8[](n);
        for (uint256 i = 0; i < n; ++i) {
            decimals[i] = uint8(data[i+2]);
        }
    }

    function getDecimals(
        bytes storage data
    ) internal view returns (uint8[] memory decimals) {
        uint256 n = getN(data);
        decimals = new uint8[](n);
        for (uint256 i = 0; i < n; ++i) {
            decimals[i] = uint8(data[i+2]);
        }
    }

    // Tokens

    function getTokens(
        address wellId
    ) internal view returns (IERC20[] memory tokens) {
        return LibWellStorage.wellInfo(wellId).tokens;
    }

    function getIJ(
        IERC20[] calldata tokens,
        IERC20 fromToken,
        IERC20 toToken
    ) internal pure returns (uint256 from, uint256 to) {
        for (uint i; i < tokens.length; ++i) {
            if (fromToken == tokens[i]) from = i;
            else if (toToken == tokens[i]) to = i;
        }
    }

    function getI(
        IERC20[] calldata tokens,
        IERC20 token
    ) internal pure returns (uint256 from) {
        for (uint i; i < tokens.length; ++i)
            if (token == tokens[i]) return i;
    }

    function getIMem(
        IERC20[] memory tokens,
        IERC20 token
    ) internal pure returns (uint256 from) {
        for (uint i; i < tokens.length; ++i)
            if (token == tokens[i]) return i;
    }

    // Encoding

    function encodeData(
        LibWellType.WellType wellType,
        uint8 numTokens,
        uint8[] memory decimals,
        bytes calldata typeData
    ) internal pure returns (bytes memory data) {
        data = abi.encodePacked(uint8(wellType), numTokens, getPackedDecimals(decimals), typeData);
    }

    function getPackedTokens(
        address[] memory tokens
    ) private pure returns (bytes memory data) {
        for (uint i; i < tokens.length; ++i) {
            data = abi.encodePacked(data, tokens[i]);
        }
    }

    function getPackedDecimals(
        uint8[] memory decimals
    ) private pure returns (bytes memory data) {
        for (uint i; i < decimals.length; ++i) {
            data = abi.encodePacked(data, decimals[i]);
        }
    }
}
