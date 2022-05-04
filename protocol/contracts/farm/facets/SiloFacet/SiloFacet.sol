/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../libraries/Balance/LibTransfer.sol";
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

    function deposit(address token, uint256 amount, LibTransfer.From mode) 
        external
        payable
        nonReentrant
        updateSilo
    {
        LibTransfer.receiveToken(IERC20(token), amount, msg.sender, mode);
        _deposit(msg.sender, token, amount);
    }

    /*
     * Withdraw
     */

    function withdrawSeason(address token, uint32 season, uint256 amount) 
        external
        payable
        updateSilo 
    {
        _withdrawDeposit(msg.sender, token, season, amount);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function withdrawSeasons(address token, uint32[] calldata seasons, uint256[] calldata amounts)
        external
        payable
        updateSilo 
    {
        _withdrawDeposits(msg.sender, token, seasons, amounts);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    /*
     * Claim
     */

    function claimSeason(address token, uint32 season, LibTransfer.To mode) 
        external
        payable
        nonReentrant
    {
        uint256 amount = removeTokenWithdrawal(msg.sender, token, season);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
        emit ClaimSeason(msg.sender, token, season, amount);
    }

    function claimSeasons(address token, uint32[] calldata seasons, LibTransfer.To mode) 
        external
        payable
        nonReentrant
    {
        uint256 amount = removeTokenWithdrawals(msg.sender, token, seasons);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
        emit ClaimSeasons(msg.sender, token, seasons, amount);
    }

    /*
     * Transfer
     */

    function transferDeposit(address recipient, address token, uint32 season, uint256 amount) 
        external
        payable
        nonReentrant
    {
        _transferDeposit(msg.sender, recipient, token, season, amount);
    }

    function transferDeposits(address recipient, address token, uint32[] calldata seasons, uint256[] calldata amounts) 
        external
        payable
        nonReentrant
    {
        _transferDeposits(msg.sender, recipient, token, seasons, amounts);
    }
    /*
     * Whitelist
     */

    function whitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external {
        require(msg.sender == address(this), "Silo: Only Beanstalk can whitelist tokens.");
        s.ss[token].selector = selector;
        s.ss[token].stalk = stalk;
        s.ss[token].seeds = seeds;
    }

    function tokenSettings(address token) external view returns (Storage.SiloSettings memory) {
        return s.ss[token];
    }
}