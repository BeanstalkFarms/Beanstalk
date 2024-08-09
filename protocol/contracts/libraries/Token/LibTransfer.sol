// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/IBean.sol";
import "./LibBalance.sol";

/**
 * @title LibTransfer
 * @author Publius
 * @notice Handles the recieving and sending of Tokens to/from internal Balances.
 */
library LibTransfer {
    using SafeERC20 for IERC20;
    using LibRedundantMath256 for uint256;

    event TokenTransferred(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        From fromMode,
        To toMode
    );

    enum From {
        EXTERNAL,
        INTERNAL,
        EXTERNAL_INTERNAL,
        INTERNAL_TOLERANT
    }
    enum To {
        EXTERNAL,
        INTERNAL
    }

    function transferToken(
        IERC20 token,
        address sender,
        address recipient,
        uint256 amount,
        From fromMode,
        To toMode
    ) internal returns (uint256 transferredAmount) {
        if (fromMode == From.EXTERNAL && toMode == To.EXTERNAL) {
            uint256 beforeBalance = token.balanceOf(recipient);
            token.safeTransferFrom(sender, recipient, amount);
            return token.balanceOf(recipient).sub(beforeBalance);
        }
        amount = receiveToken(token, amount, sender, fromMode);
        sendToken(token, amount, recipient, toMode);
        emit TokenTransferred(address(token), sender, recipient, amount, fromMode, toMode);
        return amount;
    }

    function receiveToken(
        IERC20 token,
        uint256 amount,
        address sender,
        From mode
    ) internal returns (uint256 receivedAmount) {
        if (amount == 0) return 0;
        if (mode != From.EXTERNAL) {
            receivedAmount = LibBalance.decreaseInternalBalance(
                sender,
                token,
                amount,
                mode != From.INTERNAL
            );
            if (amount == receivedAmount || mode == From.INTERNAL_TOLERANT) return receivedAmount;
        }
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(sender, address(this), amount - receivedAmount);
        return receivedAmount.add(token.balanceOf(address(this)).sub(beforeBalance));
    }

    function sendToken(IERC20 token, uint256 amount, address recipient, To mode) internal {
        if (amount == 0) return;
        if (mode == To.INTERNAL) LibBalance.increaseInternalBalance(recipient, token, amount);
        else token.safeTransfer(recipient, amount);
    }

    function burnToken(
        IBean token,
        uint256 amount,
        address sender,
        From mode
    ) internal returns (uint256 burnt) {
        // burnToken only can be called with Unripe Bean, Unripe LP or Bean token, which are all Beanstalk tokens.
        // Beanstalk's ERC-20 implementation uses OpenZeppelin's ERC20Burnable
        // which reverts if burnFrom function call cannot burn full amount.
        if (mode == From.EXTERNAL) {
            token.burnFrom(sender, amount);
            burnt = amount;
        } else {
            burnt = LibTransfer.receiveToken(token, amount, sender, mode);
            token.burn(burnt);
        }
    }

    function mintToken(IBean token, uint256 amount, address recipient, To mode) internal {
        if (mode == To.EXTERNAL) {
            token.mint(recipient, amount);
        } else {
            token.mint(address(this), amount);
            LibTransfer.sendToken(token, amount, recipient, mode);
        }
    }
}
