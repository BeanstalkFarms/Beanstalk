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
    event RemoveSeasons(address indexed account, address indexed token, uint32[] seasons, uint256[] amounts, uint256 amount);
    event RemoveSeason(address indexed account, address indexed token, uint32 season, uint256 amount);

    event Withdraw(address indexed account, address indexed token, uint32 season, uint256 amount);
    event ClaimSeasons(address indexed account, address indexed token, uint32[] seasons, uint256 amount);
    event ClaimSeason(address indexed account, address indexed token, uint32 season, uint256 amount);

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 seedsRemoved;
    }

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

    function _withdrawDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts) internal {
        require(seasons.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AssetsRemoved memory ar = removeDeposits(token, seasons, amounts);
        uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
        addTokenWithdrawal(msg.sender, token, arrivalSeason, ar.tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, ar.tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function _withdrawDeposit(address token, uint32 season, uint256 amount) internal {
        (uint256 tokensRemoved, uint256 stalkRemoved, uint256 seedsRemoved) = removeDeposit(token, season, amount);
        uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
        addTokenWithdrawal(msg.sender, token, arrivalSeason, tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
    }

    function removeDeposit(address token, uint32 season, uint256 amount) 
        private 
        returns (uint256 tokensRemoved, uint256 stalkRemoved, uint256 seedsRemoved) 
    {
        uint256 bdv;
        (tokensRemoved, bdv) = LibTokenSilo.removeDeposit(
            msg.sender,
            token,
            season,
            amount
        );
        seedsRemoved = bdv.mul(s.ss[token].seeds);
        stalkRemoved = bdv.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(seedsRemoved, _season()-season)
        );
        emit RemoveSeason(msg.sender, token, season, amount);
    }

    function removeDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory ar)
    {
        uint256 bdvRemoved;
        for (uint256 i = 0; i < seasons.length; i++) {
            (uint256 crateTokens, uint256 crateBdv) = LibTokenSilo.removeDeposit(
                msg.sender,
                token,
                seasons[i],
                amounts[i]
            );
            bdvRemoved = bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(crateTokens);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(crateBdv.mul(s.ss[token].seeds), _season()-seasons[i])
            );
        }
        ar.seedsRemoved = bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(bdvRemoved.mul(s.ss[token].stalk));
        emit RemoveSeasons(msg.sender, token, seasons, amounts, ar.tokensRemoved);
    }

    function addTokenWithdrawal(address account, address token, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].withdrawals[token][arrivalSeason] = s.a[account].withdrawals[token][arrivalSeason].add(amount);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.add(amount);
        emit Withdraw(msg.sender, token, arrivalSeason, amount);
    }

    function removeTokenWithdrawals(address account, address token, uint32[] calldata seasons) internal returns (uint256 amount) {
        for (uint256 i = 0; i < seasons.length; i++) {
            amount = amount.add(_removeTokenWithdrawal(account, token, seasons[i]));
        }
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(amount);
        return amount;
    }

    function removeTokenWithdrawal(address account, address token, uint32 season) internal returns (uint256) {
        uint256 amount = _removeTokenWithdrawal(account, token, season);
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