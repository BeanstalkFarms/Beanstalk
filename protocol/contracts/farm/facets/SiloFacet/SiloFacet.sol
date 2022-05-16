/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../libraries/Token/LibTransfer.sol";
import "../../ReentrancyGuard.sol";

/*
 * @author Publius
 * @title SiloFacet handles depositing, withdrawing and claiming whitelisted Silo tokens.
 */
contract SiloFacet is TokenSilo {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    /*
     * Deposit
     */

    function deposit(
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) external payable nonReentrant updateSilo {
        amount = LibTransfer.receiveToken(IERC20(token), amount, msg.sender, mode);
        _deposit(msg.sender, token, amount);
    }

    /*
     * Withdraw
     */

    function withdrawDeposit(
        address token,
        uint32 season,
        uint256 amount
    ) external payable updateSilo {
        _withdrawDeposit(msg.sender, token, season, amount);
    }

    function withdrawDeposits(
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable updateSilo {
        _withdrawDeposits(msg.sender, token, seasons, amounts);
    }

    /*
     * Claim
     */

    function claimWithdrawal(
        address token,
        uint32 season,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = _claimWithdrawal(msg.sender, token, season);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    function claimWithdrawals(
        address token,
        uint32[] calldata seasons,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = _claimWithdrawals(msg.sender, token, seasons);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    /*
     * Transfer
     */

    function transferDeposit(
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) external payable nonReentrant updateSilo {
        // Need to update the recipient's Silo as well.
        _update(recipient);
        _transferDeposit(msg.sender, recipient, token, season, amount);
    }

    function transferDeposits(
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable nonReentrant updateSilo {
        // Need to update the recipient's Silo as well.
        _update(recipient);
        _transferDeposits(msg.sender, recipient, token, seasons, amounts);
    }

    /*
     * Silo
     */

    function update(address account) external payable {
        _update(account);
    }

    function earn(address account) external payable returns (uint256 beans) {
        return _earn(account);
    }

    function claimPlenty(address account) external payable {
        _claimPlenty(account);
    }
}
