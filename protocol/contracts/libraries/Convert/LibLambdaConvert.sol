// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvertData} from "./LibConvertData.sol";

/**
 * @title LibLambdaConvert
 * @author Publius, deadmanwalking
 */
library LibLambdaConvert {
    using LibConvertData for bytes;

    /**
     * @notice This function returns the full input for use in lambda convert
     * In lambda convert, the account converts from and to the same token.
     */
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

    /** 
     * @notice This function returns the full input for use in anti-lamda convert
     * In anti lamda convert, any user can convert on behalf of an account 
     * to update a deposit's bdv.
     * This is why the additional 'account' parameter is returned.
     */
    function antiConvert(bytes memory convertData)
        internal
        pure
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn,
            address account,
            bool decreaseBDV
        )
    {
        (amountIn, tokenIn, account, decreaseBDV) = convertData.antiLambdaConvert();
        tokenOut = tokenIn;
        amountOut = amountIn;
    }
}
