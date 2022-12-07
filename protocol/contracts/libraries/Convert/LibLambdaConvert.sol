/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibConvertData.sol";

/**
 * @title Lib Lambda Convert
 **/

library LibLambdaConvert {
    using LibConvertData for bytes;

    function convert(bytes memory convertData)
        internal
        pure
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        (inAmount, tokenIn) = convertData.lambdaConvert();
        tokenOut = tokenIn;
        outAmount = inAmount;
    }
}
