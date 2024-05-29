/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "../../beanstalk/silo/ConvertFacet.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LibConvert} from "../../libraries/Convert/LibConvert.sol";
import {LibTractor} from "../../libraries/LibTractor.sol";

/**
 * @author Publius
 * @title Mock Convert Facet
 **/
contract MockConvertFacet is ConvertFacet {
    using LibRedundantMath256 for uint256;
    using SafeERC20 for IERC20;

    event MockConvert(uint256 stalkRemoved, uint256 bdvRemoved);

    function withdrawForConvertE(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens
    ) external {
        LibSilo._mow(LibTractor._user(), token);
        (uint256 stalkRemoved, uint256 bdvRemoved) = LibConvert._withdrawTokens(
            token,
            stems,
            amounts,
            maxTokens
        );

        emit MockConvert(stalkRemoved, bdvRemoved);
    }

    function depositForConvertE(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk
    ) external {
        LibSilo._mow(LibTractor._user(), token);
        LibConvert._depositTokensForConvert(token, amount, bdv, grownStalk);
    }

    function convertInternalE(
        address tokenIn,
        uint amountIn,
        bytes calldata convertData
    ) external returns (address toToken, address fromToken, uint256 toAmount, uint256 fromAmount) {
        IERC20(tokenIn).safeTransferFrom(LibTractor._user(), address(this), amountIn);
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(convertData);
        IERC20(toToken).safeTransfer(LibTractor._user(), toAmount);
    }
}
