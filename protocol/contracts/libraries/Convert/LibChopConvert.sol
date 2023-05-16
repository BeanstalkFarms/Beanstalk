// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "./LibConvertData.sol";
import "~/libraries/LibChop.sol";
import "../../C.sol";

/**
 * @title LibChopConvert
 * @author deadmanwalking
 */
library LibChopConvert {
    using LibConvertData for bytes;

    /**
     * @notice Converts an unripe asset into its ripe counterpart
     * @param convertData The encoded data containing the info for the convert
     * @return tokenOut The address of the ripe token to be returned after the convert
     * @return tokenIn The address of the unripe token to be converted
     * @return amountOut The amount of the ripe asset credited after the convert
     * @return amountIn The amount of the unripe asset to be converted
     */
    function convertUnripeBeansToBeans(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        // decode convertdata == amount of unripe to be converted
        (amountIn, tokenIn) = convertData.lambdaConvert();
        // get the tokenOut address (BEAN address)
        tokenOut = C.beanAddress();
        // perform the convert (chop)
        amountOut = LibChop.chop(tokenIn, amountIn, LibTransfer.From.INTERNAL , LibTransfer.To.INTERNAL);
    }

    /**
     * @notice Retruns the final amount of ripe assets converted from its unripe counterpart
     * @param tokenIn The address of the unripe token converted
     * @param amountIn The amount of the unripe asset converted
     */
    function getBeanAmountOut(address tokenIn, uint256 amountIn) internal view returns(uint256 amount) {
        // tokenIn == unripe bean address
        uint256 unripeSupply = IERC20(tokenIn).totalSupply();
        amount = LibChop._getPenalizedUnderlying(tokenIn, amountIn, unripeSupply);
    }
}



//
// library LibLambdaConvert {
//     using LibConvertData for bytes;

//     function convert(bytes memory convertData)
//         internal
//         returns (
//             address tokenOut,
//             address tokenIn,
//             uint256 amountOut,
//             uint256 amountIn
//         )
//     {
//         (amountIn, tokenIn) = convertData.lambdaConvert();
//         LibInternal.mow(msg.sender, tokenIn);
//         if (tokenIn != tokenOut) {
//             LibInternal.mow(msg.sender, tokenOut);
//         }
//         tokenOut = tokenIn;
//         amountOut = amountIn;
//     }
// }

