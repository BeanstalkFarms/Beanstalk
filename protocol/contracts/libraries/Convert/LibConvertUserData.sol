/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author LeoFib
 * @title LibConvertUserData
 **/

library LibConvertUserData {
    // In order to preserve backwards compatibility, make sure new kinds are added at the end of the enum.
    enum ConvertKind {
        BEANS_TO_CURVE_LP,
        CURVE_LP_TO_BEANS
    }

    /// @notice Decoder for the Convert Enum
    function convertKind(bytes memory self)
        internal
        pure
        returns (ConvertKind)
    {
        return abi.decode(self, (ConvertKind));
    }

    /**
     * Sell To Peg Convert Functions Uniswap
     **/

    /// @notice Decoder for the addLPInBeans Convert
    function basicConvert(bytes memory self)
        internal
        pure
        returns (uint256 amountIn, uint256 minAmontOut)
    {
        (, amountIn, minAmontOut) = abi.decode(
            self,
            (ConvertKind, uint256, uint256)
        );
    }

    /// @notice Decoder for the addLPInBeans Convert
    function convertWithAddress(bytes memory self)
        internal
        pure
        returns (
            uint256 amountIn,
            uint256 minAmontOut,
            address token
        )
    {
        (, amountIn, minAmontOut, token) = abi.decode(
            self,
            (ConvertKind, uint256, uint256, address)
        );
    }
}
