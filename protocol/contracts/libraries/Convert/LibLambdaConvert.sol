/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibConvertData.sol";
import "~/libraries/LibInternal.sol";

/**
 * @title Lib Lambda Convert
 **/

library LibLambdaConvert {
    using LibConvertData for bytes;

    function convert(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        (inAmount, tokenIn) = convertData.lambdaConvert();
        LibInternal.mow(msg.sender, tokenIn); //this convert function used to be pure, had to remove pure in order to mow
        tokenOut = tokenIn;
        outAmount = inAmount;
    }
}
