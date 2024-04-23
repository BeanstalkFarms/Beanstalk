/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";

/**
 * @author Publius
 * @title ConvertGettersFacet contains view functions related to converting Deposited assets.
 **/
contract ConvertGettersFacet {

    /**
     * @notice Returns the maximum amount that can be converted of `tokenIn` to `tokenOut`.
     */
    function getMaxAmountIn(address tokenIn, address tokenOut)
        external
        view
        returns (uint256 amountIn)
    {
        return LibConvert.getMaxAmountIn(tokenIn, tokenOut);
    }

    /**
     * @notice Returns the amount of `tokenOut` recieved from converting `amountIn` of `tokenIn`.
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return LibConvert.getAmountOut(tokenIn, tokenOut, amountIn);
    }

    // TODO: rename this function? somehow indicate that is uses capped reserves?
    function overallCappedDeltaB() external view returns (int256 deltaB) {
        return LibWellMinting.overallCappedDeltaB();
    }
}
