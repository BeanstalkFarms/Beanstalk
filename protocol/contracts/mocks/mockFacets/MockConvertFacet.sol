/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../beanstalk/silo/ConvertFacet.sol";

/**
 * @author Publius
 * @title Mock Convert Facet
**/
contract MockConvertFacet is ConvertFacet {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event MockConvert(uint256 stalkRemoved, uint256 bdvRemoved);

    function withdrawForConvertE(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens
    ) external {
        (uint256 stalkRemoved, uint256 bdvRemoved) = _withdrawTokens(token, stems, amounts, maxTokens);
        
        
        emit MockConvert(stalkRemoved, bdvRemoved);
    }

    function depositForConvertE(
        address token, 
        uint256 amount, 
        uint256 bdv, 
        uint256 grownStalk
    ) external {
        _depositTokensForConvert(token, amount, bdv, grownStalk);
    }

    function convertInternalE(
        address tokenIn,
        uint amountIn,
        bytes calldata convertData
    ) external returns (
        address toToken,
        address fromToken,
        uint256 toAmount,
        uint256 fromAmount
    ) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(
            convertData
        );
        IERC20(toToken).safeTransfer(msg.sender, toAmount);
    }
}
