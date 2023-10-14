// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvertData} from "./LibConvertData.sol";
import {LibChop} from "contracts/libraries/LibChop.sol";
import {C} from "contracts/C.sol";
import {IBean} from "contracts/interfaces/IBean.sol";

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
    function convertUnripeToRipe(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        // Decode convertdata
        (amountIn, tokenIn) = convertData.lambdaConvert();
       
        (tokenOut, amountOut) = LibChop.chop(
            tokenIn, 
            amountIn, 
            IBean(tokenIn).totalSupply()
        );
        // LibChop.chop decrements the amount of an unripe asset in circulation from storage.
        // thus, the unripe asset still needs to be burned directly.
        IBean(tokenIn).burn(amountIn);
    }

    /**
     * @notice Retruns the final amount of ripe assets converted from its unripe counterpart
     * @param tokenIn The address of the unripe token converted
     * @param amountIn The amount of the unripe asset converted
     */
    function getRipeOut(address tokenIn, uint256 amountIn) internal view returns(uint256 amount) {
        // tokenIn == unripe bean address
        amount = LibChop._getPenalizedUnderlying(
            tokenIn,
            amountIn, 
            IBean(tokenIn).totalSupply()
        );
    }
}