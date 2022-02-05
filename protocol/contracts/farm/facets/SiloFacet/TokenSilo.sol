/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./UpdateSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";

/**
 * @author Publius
 * @title Token Silo
**/
contract TokenSilo is UpdateSilo {

    using SafeMath for uint256;
    using SafeMath for uint32;

    event TokenDeposit(address indexed account, address indexed token, uint32 season, uint256 amount, uint256 bdv);
    event TokenRemove(address indexed account, address indexed token, uint32[] seasons, uint256[] amounts, uint256 amount);
    event TokenWithdraw(address indexed account, address indexed token, uint32 season, uint256 amount);
    event LegacyLPRemove(address indexed account, uint32[] seasons, uint256[] crateLP, bool[] legacy, uint256 lp);

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 seedsRemoved;
    }

    /**
     * Getters
    **/

    function tokenDeposit(address account, address token, uint32 id) public view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, id);
    }

    function tokenWithdrawal(address account, address token, uint32 id) public view returns (uint256) {
        return LibTokenSilo.tokenWithdrawal(account, token, id);
    }

    // V2 For All Token Types
    function totalDeposited(address token) public view returns (uint256) {
        return s.siloBalances[IERC20(token)].deposited;
    }

    function totalWithdrawn(address token) public view returns (uint256) {
        return s.siloBalances[IERC20(token)].withdrawn;
    }

    /**
     * Internal
    **/

    function _deposit(address token, uint256 amount) internal {
        updateSilo(msg.sender);
        (uint256 seeds, uint256 stalk) = LibTokenSilo.deposit(msg.sender, token, season(), amount);
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);
    }

    function _withdraw(address token, uint32[] calldata seasons, uint256[] calldata amounts) internal {
        updateSilo(msg.sender);
        require(seasons.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AssetsRemoved memory ar = removeDeposits(token, seasons, amounts);
        uint32 arrivalSeason = season() + s.season.withdrawSeasons;
        addTokenWithdrawal(msg.sender, token, arrivalSeason, ar.tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, ar.tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, ar.seedsRemoved, ar.stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function removeDeposits(address token, uint32[] calldata seasons, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory ar)
    {
        if (token == C.beanAddress()) return removeBeanDeposits(seasons, amounts);
        for (uint256 i = 0; i < seasons.length; i++) {
            (uint256 crateBeans, uint256 crateBdv) = LibTokenSilo.removeDeposit(
                msg.sender,
                token,
                seasons[i],
                amounts[i]
            );
            ar.tokensRemoved = ar.tokensRemoved.add(crateBeans);
            ar.stalkRemoved = ar.stalkRemoved.add(crateBdv.mul(s.ss[token].stalk).add(
                LibSilo.stalkReward(crateBdv, season()-seasons[i]))
            );
            ar.seedsRemoved = ar.seedsRemoved.add(crateBdv.mul(s.ss[token].seeds));
        }
        emit TokenRemove(msg.sender, token, seasons, amounts, ar.tokensRemoved);
    }

    function addTokenWithdrawal(address account, address token, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].withdrawals[IERC20(token)][arrivalSeason] = s.a[account].withdrawals[IERC20(token)][arrivalSeason].add(amount);
        s.siloBalances[IERC20(token)].withdrawn = s.siloBalances[IERC20(token)].withdrawn.add(amount);
        emit TokenWithdraw(msg.sender, token, arrivalSeason, amount);
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    /*
     * Bean
     */


    function removeBeanDeposits(uint32[] calldata seasons, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory ar)
    {
        for (uint256 i = 0; i < seasons.length; i++) {
            uint256 crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, seasons[i], amounts[i]);
            ar.tokensRemoved = ar.tokensRemoved.add(crateBeans);
            ar.stalkRemoved = ar.stalkRemoved.add(crateBeans.mul(C.getStalkPerBean()).add(
                LibSilo.stalkReward(crateBeans.mul(C.getSeedsPerBean()), season()-seasons[i]))
            );
        }
        ar.seedsRemoved = ar.tokensRemoved.mul(C.getSeedsPerBean());
        emit TokenRemove(msg.sender, C.beanAddress(), seasons, amounts, ar.tokensRemoved);
    }

    /*
     * Legacy
     */

    function legacyLPDeposit(address account, uint32 id) public view returns (uint256, uint256) {
       return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]/4);
    }

    function legacyLPWithdrawal(address account, uint32 id) public view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].lp.withdrawals[id];
    }

    function beanDeposit(address account, uint32 id) public view returns (uint256) {
        return s.a[account].bean.deposits[id];
    }

    function legacyBeanWithdrawal(address account, uint32 i) public view returns (uint256) {
            return s.a[account].bean.withdrawals[i];
    }
}
