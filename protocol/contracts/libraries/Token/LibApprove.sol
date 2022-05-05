/*
 SPDX-License-Identifier: MIT
*/

pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @author publius
 * @title LibApproval handles approval other ERC-20 tokens.
 **/

library LibApprove {

    using SafeERC20 for IERC20;

    function approveToken(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        if (token.allowance(address(this), spender) == type(uint256).max) return;
        token.safeIncreaseAllowance(spender, amount);
    }
}
