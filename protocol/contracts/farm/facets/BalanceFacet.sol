/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../AppStorage.sol";
import "../../libraries/LibUserBalance.sol";

/**
 * @author Publius
 * @title Balance handles transferring assets between external and internal balances.
**/

contract BalanceFacet {

    using SafeMath for uint256;

    AppStorage internal s;

    /*
     * Balances
     */

    function internalBalanceOf(address account, address token) public view returns (uint256) {
        return LibUserBalance._getInternalBalance(account, IERC20(token));
    }

    function totalBalanceOf(address account, address token) public view returns (uint256) {
        return LibUserBalance._getBalance(account, IERC20(token));
    }

    function internalBalancesOf(address account, address[] memory tokens)
        public
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = LibUserBalance._getInternalBalance(account, IERC20(tokens[i]));
        }
    }

    function balancesOf(address account, address[] memory tokens)
        public
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = LibUserBalance._getBalance(account, IERC20(tokens[i]));
        }
    }

    function transfer(
        address token,
        address recipient,
        uint256 amount, 
        bool fromInternalBalance,
        bool toInternalBalance
    ) public {
        LibUserBalance._transfer(IERC20(token), msg.sender, recipient, amount, fromInternalBalance, toInternalBalance);
    }

    function toInternalBalance(address token, uint256 amount) public {
        LibUserBalance._convertToInternalBalance(IERC20(token), msg.sender, amount);
    }

    function toExternalBalance(address token, uint256 amount) public {
        LibUserBalance._convertToExternalBalance(IERC20(token), msg.sender, amount);
    }
}
