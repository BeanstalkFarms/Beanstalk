// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvertData} from "./LibConvertData.sol";

/**
 * @title LibLambdaConvert
 * @author Publius
 */
library LibLambdaConvert {
    using LibConvertData for bytes;

    function convert(bytes memory convertData)
        internal
        pure
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        (amountIn, tokenIn) = convertData.lambdaConvert();
        tokenOut = tokenIn;
        amountOut = amountIn;
    }
}
