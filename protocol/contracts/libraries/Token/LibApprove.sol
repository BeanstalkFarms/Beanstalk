/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @author publius
 * @title LibApproval handles approval other ERC-20 tokens.
 **/

library LibApprove {
    using SafeERC20 for IERC20;

    function approveToken(IERC20 token, address spender, uint256 amount) internal {
        if (token.allowance(address(this), spender) == type(uint256).max) return;
        token.forceApprove(spender, amount);
    }
}
