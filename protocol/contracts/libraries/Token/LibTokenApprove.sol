// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibAppStorage} from "../LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";

/**
 * @title LibTokenApprove
 * @author Publius
 */
library LibTokenApprove {
    event TokenApproval(
        address indexed owner,
        address indexed spender,
        IERC20 token,
        uint256 amount
    );

    function approve(address account, address spender, IERC20 token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.accts[account].tokenAllowances[spender][token] = amount;
        emit TokenApproval(account, spender, token, amount);
    }

    function allowance(
        address account,
        address spender,
        IERC20 token
    ) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.accts[account].tokenAllowances[spender][token];
    }

    function spendAllowance(address owner, address spender, IERC20 token, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender, token);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Token: insufficient allowance");
            approve(owner, spender, token, currentAllowance - amount);
        }
    }
}
