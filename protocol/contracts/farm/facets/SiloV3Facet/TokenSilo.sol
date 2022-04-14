/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../ReentrancyGuard.sol";
/**
 * @author Publius
 * @title Token Silo
**/
contract TokenSilo is ReentrancyGuard {

    uint32 private constant ASSET_PADDING = 100;

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event Deposit(address indexed account, address indexed token, uint256 season, uint256 amount, uint256 bdv);
    event Remove(address indexed account, address indexed token, uint256 amount, uint256 removedAmount);

    event Withdraw(address indexed account, address indexed token, uint32 season, uint256 amount);
    event Claim(address indexed account, address indexed token, uint256 amount);

    /**
     * Getters
    **/

    function getDeposit(address account, address token, uint32 season) external view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, season);
    }

    function getWithdrawal(address account, address token, uint32 season) external view returns (uint256) {
        return LibTokenSilo.tokenWithdrawal(account, token, season);
    }

    function getTotalDeposited(address token) external view returns (uint256) {
        return s.siloBalances[token].deposited;
    }

    function getTotalWithdrawn(address token) external view returns (uint256) {
        return s.siloBalances[token].withdrawn;
    }

    /**
     * Internal
    **/

    function _deposit(address token, uint256 amount) internal {
        LibInternal.updateSilo(msg.sender);
        (uint256 seeds, uint256 stalk) = LibTokenSilo.deposit(msg.sender, token, _season(), amount);
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
    }

    function _withdraw(address token, uint256 amount) internal {
        (uint256 tokensRemoved, uint256 stalkRemoved, uint256 seedsRemoved) = removeDeposit(token, amount);
        uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
        addTokenWithdrawal(msg.sender, token, arrivalSeason, tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
    }

    function removeDeposit(address token, uint256 amount)
        private 
        returns (uint256 tokensRemoved, uint256 stalkRemoved, uint256 seedsRemoved) 
    {
        uint32 current = s.a[msg.sender].depositSeasonsHead[token];
        uint256 bdvRemoved;
        while (current != uint32(0)) {
            uint32 season = current;
            current = s.a[msg.sender].depositSeasons[token][current];

            (uint256 crateAmount,) = LibTokenSilo.tokenDeposit(msg.sender, token, season);
            uint256 removeAmount = crateAmount >= amount ? amount : crateAmount;
            amount = amount.sub(removeAmount);

            (uint256 crateTokens, uint256 crateBdv) = LibTokenSilo.removeDeposit(
                msg.sender,
                token,
                season,
                removeAmount
            );
            bdvRemoved = bdvRemoved.add(crateBdv);
            tokensRemoved = tokensRemoved.add(crateTokens);
            uint256 seeds = crateBdv.mul(s.ss[token].seeds);
            uint256 stalkReward = LibSilo.stalkReward(seeds, _season()-season);
            stalkRemoved = stalkRemoved.add(stalkReward);
        }

        seedsRemoved = bdvRemoved.mul(s.ss[token].seeds);
        stalkRemoved = stalkRemoved.add(bdvRemoved.mul(s.ss[token].stalk));

        emit Remove(msg.sender, token, amount, tokensRemoved);
    }

    function addTokenWithdrawal(address account, address token, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].withdrawals[token][arrivalSeason] = s.a[account].withdrawals[token][arrivalSeason].add(amount);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.add(amount);
        LibTokenSilo.addWithdrawalSeason(account, token, arrivalSeason);
        emit Withdraw(msg.sender, token, arrivalSeason, amount);
    }

    function removeTokenWithdrawals(address account, address token) internal returns (uint256 amount) {
        uint32 current = s.a[account].withdrawalSeasonsHead[token];
        while (current != uint32(0)) {
            amount = amount.add(_removeTokenWithdrawal(account, token, current));
            current = s.a[account].withdrawalSeasons[token][current];
            delete s.a[account].withdrawalSeasons[token][current];
            delete s.a[account].withdrawalSeasonExists[token][current];
        }
        delete s.a[account].withdrawalSeasonsHead[token];
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(amount);
        return amount;
    }

    function _removeTokenWithdrawal(address account, address token, uint32 season) private returns (uint256) {
        require(season <= s.season.current, "Claim: Withdrawal not recievable.");
        uint256 amount = s.a[account].withdrawals[token][season];
        delete s.a[account].withdrawals[token][season];
        return amount;
    }

    function _season() private view returns (uint32) {
        return s.season.current;
    }
}