/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "../../beanstalk/silo/ConvertFacet.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LibConvert} from "../../libraries/Convert/LibConvert.sol";
import {LibTractor} from "../../libraries/LibTractor.sol";
import {LibConvert} from "../../libraries/Convert/LibConvert.sol";

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
        uint256 maxTokens,
        address account
    ) external {
        LibSilo._mow(msg.sender, token);
        if (account == address(0)) account = msg.sender;
        (uint256 stalkRemoved, uint256 bdvRemoved) = LibConvert._withdrawTokens(
            token,
            stems,
            amounts,
            maxTokens,
            account
        );

        emit MockConvert(stalkRemoved, bdvRemoved);
    }

    function depositForConvertE(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk,
        address account
    ) external {
        LibSilo._mow(msg.sender, token);
        if (account == address(0)) account = msg.sender;
        LibConvert._depositTokensForConvert(token, amount, bdv, grownStalk, account);
    }

    function convertInternalE(
        address tokenIn,
        uint amountIn,
        bytes calldata convertData
    )
        external
        returns (
            address toToken,
            address fromToken,
            uint256 toAmount,
            uint256 fromAmount,
            address account,
            bool decreaseBDV
        )
    {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        LibConvert.convertParams memory cp = LibConvert.convert(convertData);
        toToken = cp.toToken;
        fromToken = cp.fromToken;
        toAmount = cp.toAmount;
        fromAmount = cp.fromAmount;
        account = cp.account;
        decreaseBDV = cp.decreaseBDV;
        IERC20(toToken).safeTransfer(msg.sender, toAmount);
    }
}
