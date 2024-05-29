// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @title LibConvertData
 * @author LeoFib
 */
library LibConvertData {
    // In order to preserve backwards compatibility, make sure new kinds are added at the end of the enum.
    enum ConvertKind {
        DEPRECATED_0, // BEANS_TO_CURVE_LP
        DEPRECATED_1, // CURVE_LP_TO_BEANS
        UNRIPE_BEANS_TO_UNRIPE_LP,
        UNRIPE_LP_TO_UNRIPE_BEANS,
        LAMBDA_LAMBDA,
        BEANS_TO_WELL_LP,
        WELL_LP_TO_BEANS,
        UNRIPE_TO_RIPE
    }

    /// @notice Decoder for the Convert Enum
    function convertKind(bytes memory self) internal pure returns (ConvertKind) {
        return abi.decode(self, (ConvertKind));
    }

    /// @notice Decoder for the addLPInBeans Convert
    function basicConvert(
        bytes memory self
    ) internal pure returns (uint256 amountIn, uint256 minAmontOut) {
        (, amountIn, minAmontOut) = abi.decode(self, (ConvertKind, uint256, uint256));
    }

    /// @notice Decoder for the addLPInBeans Convert
    function convertWithAddress(
        bytes memory self
    ) internal pure returns (uint256 amountIn, uint256 minAmontOut, address token) {
        (, amountIn, minAmontOut, token) = abi.decode(
            self,
            (ConvertKind, uint256, uint256, address)
        );
    }

    /// @notice Decoder for the lambdaConvert
    function lambdaConvert(
        bytes memory self
    ) internal pure returns (uint256 amount, address token) {
        (, amount, token) = abi.decode(self, (ConvertKind, uint256, address));
    }
}
