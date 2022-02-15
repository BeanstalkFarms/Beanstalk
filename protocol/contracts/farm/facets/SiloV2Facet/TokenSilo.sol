/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibUserBalance.sol";

/**
 * @author Publius
 * @title Token Silo
**/
contract TokenSilo {

    uint32 private constant ASSET_PADDING = 100;

    AppStorage internal s;

    using SafeMath for uint256;
    using SafeMath for uint32;

    event Deposit(address indexed account, address indexed token, uint256 season, uint256 amount, uint256 bdv);
    event Remove(address indexed account, address indexed token, uint32[] seasons, uint256[] amounts, uint256 amount);
    event Withdraw(address indexed account, address indexed token, uint32 season, uint256 amount);
    event ClaimWithdrawal(address indexed account, address indexed token, uint32 season, uint256 amount);


    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 seedsRemoved;
    }

    /**
     * Getters
    **/

    function getDeposit(address account, address token, uint32 season) public view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, season);
    }

    function getWithdrawal(address account, address token, uint32 season) public view returns (uint256) {
        return LibTokenSilo.tokenWithdrawal(account, token, season);
    }

    // V2 For All Token Types
    function getTotalDeposited(address token) public view returns (uint256) {
        return s.siloBalances[IERC20(token)].deposited;
    }

    function getTotalWithdrawn(address token) public view returns (uint256) {
        return s.siloBalances[IERC20(token)].withdrawn;
    }

    /**
     * Internal
    **/

    function _deposit(address token, uint256 amount, bool partialUpdateSilo) internal {
        LibInternal.updateSilo(msg.sender, partialUpdateSilo);
        (uint256 seeds, uint256 stalk) = LibTokenSilo.deposit(msg.sender, token, _season(), amount);
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
    }

    function _withdraw(address token, uint32[] calldata seasons, uint256[] calldata amounts, bool partialUpdateSilo) internal {
        LibInternal.updateSilo(msg.sender, partialUpdateSilo);
        require(seasons.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AssetsRemoved memory ar = removeDeposits(token, seasons, amounts);
        uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
        addTokenWithdrawal(msg.sender, token, arrivalSeason, ar.tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, ar.tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function removeDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory ar)
    {
        uint256 bdvRemoved;
        for (uint256 i = 0; i < seasons.length; i++) {
            (uint256 crateBeans, uint256 crateBdv) = LibTokenSilo.removeDeposit(
                msg.sender,
                token,
                seasons[i],
                amounts[i]
            );
            bdvRemoved = bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(crateBeans);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(crateBdv, _season()-seasons[i])
            );
        }
        ar.seedsRemoved = bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(bdvRemoved.mul(s.ss[token].stalk));
        emit Remove(msg.sender, token, seasons, amounts, ar.tokensRemoved);
    }

    function addTokenWithdrawal(address account, address token, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].withdrawals[IERC20(token)][arrivalSeason] = s.a[account].withdrawals[IERC20(token)][arrivalSeason].add(amount);
        s.siloBalances[IERC20(token)].withdrawn = s.siloBalances[IERC20(token)].withdrawn.add(amount);
        emit Withdraw(msg.sender, token, arrivalSeason, amount);
    }

    function removeTokenWithdrawal(address account, address token, uint32 _s) internal returns (uint256) {
        uint256 amount = s.a[account].withdrawals[IERC20(token)][_s];
        require(amount > 0, "Silo: Withdrawal is empty.");
        delete s.a[account].withdrawals[IERC20(token)][_s];
        s.siloBalances[IERC20(token)].withdrawn = s.siloBalances[IERC20(token)].withdrawn.sub(amount);
        return amount;
    }

    function _season() private view returns (uint32) {
        return s.season.current;
    }
}