// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibConvertData} from "./LibConvertData.sol";
import {LibChop} from "contracts/libraries/LibChop.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {C} from "contracts/C.sol";
import {IBean} from "contracts/interfaces/IBean.sol";

/**
 * @title LibChopConvert
 * @author deadmanwalking
 */
library LibChopConvert {
    using LibConvertData for bytes;

    /**
     * @notice Converts Deposited Unripe tokens into their Deposited Ripe Tokens.
     * @param convertData The encoded data containing the info for the convert.
     * @return tokenOut The address of the Ripe Token received after the Convert.
     * @return tokenIn The address of the Unripe Token to be converted.
     * @return amountOut The amount of Ripe Tokens received after the Convert.
     * @return amountIn The amount of Unripe Tokens to be converted.
     */
    function convertUnripeToRipe(
        bytes memory convertData
    ) internal returns (address tokenOut, address tokenIn, uint256 amountOut, uint256 amountIn) {
        // Decode convertdata
        (amountIn, tokenIn) = convertData.lambdaConvert();

        (tokenOut, amountOut) = LibChop.chop(tokenIn, amountIn, IBean(tokenIn).totalSupply());

        IBean(tokenIn).burn(amountIn);
    }

    /**
     * @notice Returns the final amount of ripe assets converted from its unripe counterpart
     * @param tokenIn The address of the unripe token converted
     * @param amountIn The amount of the unripe asset converted
     */
    function getConvertedUnderlyingOut(
        address tokenIn,
        uint256 amountIn
    ) internal view returns (uint256 amount) {
        // tokenIn == unripe bean address
        amount = LibUnripe._getPenalizedUnderlying(tokenIn, amountIn, IBean(tokenIn).totalSupply());
    }
}
