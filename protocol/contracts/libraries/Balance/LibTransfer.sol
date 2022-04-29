/*
 SPDX-License-Identifier: MIT
*/

/**
 * @author publius
 * @title LibTransfer handles the recieving and sending of Tokens to/from internal Balances.
**/
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./LibBalance.sol";

library LibTransfer {
    using SafeERC20 for IERC20;

    enum FromBalance{ EXTERNAL, INTERNAL, EXTERNAL_INTERNAL, INTERNAL_TOLERANT }
    enum ToBalance{ EXTERNAL, INTERNAL }

    function transferToken(
        IERC20 token,
        address recipient,
        uint256 amount,
        FromBalance fromMode,
        ToBalance toMode
    ) internal {
        if (fromMode == FromBalance.EXTERNAL &&
            toMode == ToBalance.EXTERNAL) {
            token.transferFrom(msg.sender, recipient, amount);
            return;
        }
        receiveToken(token, amount, msg.sender, fromMode);
        sendToken(token, amount, recipient, toMode);
    }

    function receiveToken(
        IERC20 token,
        uint256 amount,
        address sender,
        FromBalance mode
    ) internal returns (uint256 receivedAmount) {
        if (amount == 0) return 0;
        if (mode != FromBalance.EXTERNAL) {
            receivedAmount = LibBalance.decreaseInternalBalance(sender, token, amount, mode != FromBalance.INTERNAL);
            if (amount == receivedAmount || mode == FromBalance.INTERNAL_TOLERANT) return receivedAmount;
        }
        token.safeTransferFrom(sender, address(this), amount - receivedAmount);
    }

    function sendToken(
        IERC20 token,
        uint256 amount,
        address recipient,
        ToBalance mode
    ) internal {
        if (amount == 0) return;
        if (mode == ToBalance.INTERNAL) LibBalance.increaseInternalBalance(recipient, token, amount);
        else token.safeTransfer(recipient, amount);
    }
}