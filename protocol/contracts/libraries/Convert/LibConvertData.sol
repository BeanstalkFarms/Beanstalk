// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title LibConvertData
 * @author LeoFib
 */
library LibConvertData {
    // In order to preserve backwards compatibility, make sure new kinds are added at the end of the enum.
    enum ConvertKind {
        BEANS_TO_CURVE_LP,
        CURVE_LP_TO_BEANS,
        UNRIPE_BEANS_TO_UNRIPE_LP,
        UNRIPE_LP_TO_UNRIPE_BEANS,
        LAMBDA_LAMBDA,
        BEANS_TO_WELL_LP,
        WELL_LP_TO_BEANS,
        FARM_CONVERT
    }

    /// @notice Decoder for the Convert Enum
    function convertKind(bytes memory data)
        internal
        pure
        returns (ConvertKind)
    {
        return abi.decode(data, (ConvertKind));
    }

    /// @notice Decoder for the addLPInBeans Convert
    function basicConvert(bytes memory data)
        internal
        pure
        returns (uint256 amountIn, uint256 minAmountOut)
    {
        (, amountIn, minAmountOut) = abi.decode(
            data,
            (ConvertKind, uint256, uint256)
        );
    }

    /// @notice Decoder for the addLPInBeans Convert
    function convertWithAddress(bytes memory data)
        internal
        pure
        returns (
            uint256 amountIn,
            uint256 minAmountOut,
            address token
        )
    {
        (, amountIn, minAmountOut, token) = abi.decode(
            data,
            (ConvertKind, uint256, uint256, address)
        );
    }

    function lambdaConvert(bytes memory data)
        internal
        pure
        returns (uint256 amount, address token)
    {
        (, amount, token) = abi.decode(data, (ConvertKind, uint256, address));
    }

    function farmConvert(bytes memory data)
        internal
        pure
        returns (
            uint256 amountIn, //amount of whitelisted asset passed in to convert
            uint256 minAmountOut,
            address tokenIn,
            address tokenOut,
            AdvancedFarmCall[] calldata farmData
        )
    {
        (, amountIn, minAmountOut, tokenIn, tokenOut, farmData) = abi.decode(
            data,
            (ConvertKind, uint256, uint256, address, address, AdvancedFarmCall[])
        );
    }
}
