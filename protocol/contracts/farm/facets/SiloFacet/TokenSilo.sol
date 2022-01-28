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

    event TokenDeposit(address indexed account, address indexed token, uint256 season, uint256 amount, uint256 bdv);
    event TokenRemove(address indexed account, address indexed token, uint32[] crates, uint256[] crateTokens, uint256 amount);
    event TokenWithdraw(address indexed account, address indexed token, uint256 season, uint256 amount);
    event LegacyLPRemove(address indexed account, uint32[] crates, uint256[] crateLP, bool[] legacy, uint256 lp);

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

    function deposit(address token, uint256 amount) public {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _deposit(token, amount, LibToolShed.defaultSettings());
    }

    function withdraw(address token, uint32[] calldata crates, uint256[] calldata amounts) public {
        _withdraw(token, crates, amounts, LibToolShed.defaultSettings());
    }

    /**
     * Internal
    **/

    function _deposit(address token, uint256 amount, Storage.Settings memory set) internal {
        updateSilo(msg.sender, set.toInternalBalance, set.lightUpdateSilo);
        uint256 bdv = LibTokenSilo.deposit(msg.sender, token, season(), amount);
        LibSilo.depositSiloAssets(msg.sender, bdv.mul(s.ss[token].seeds), bdv.mul(s.ss[token].stalk), set.toInternalBalance);
    }

    function _withdraw(address token, uint32[] calldata crates, uint256[] calldata amounts, Storage.Settings memory set) internal {
        updateSilo(msg.sender, set.toInternalBalance, set.lightUpdateSilo);
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        AssetsRemoved memory assetsRemoved = removeDeposits(token, crates, amounts);
        uint32 arrivalSeason = season() + s.season.withdrawSeasons;
        addTokenWithdrawal(msg.sender, token, arrivalSeason, assetsRemoved.tokensRemoved);
        LibTokenSilo.decrementDepositedToken(token, assetsRemoved.tokensRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, assetsRemoved.seedsRemoved, assetsRemoved.stalkRemoved, set.fromInternalBalance);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function removeDeposits(address token, uint32[] calldata crates, uint256[] calldata amounts)
        private
        returns (AssetsRemoved memory assetsRemoved)
    {
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateBdv) = LibTokenSilo.removeDeposit(
                msg.sender,
                token,
                crates[i],
                amounts[i]
            );
            assetsRemoved.tokensRemoved = assetsRemoved.tokensRemoved.add(crateBeans);
            assetsRemoved.stalkRemoved = assetsRemoved.stalkRemoved.add(crateBdv.mul(s.ss[token].stalk).add(
                LibSilo.stalkReward(crateBdv, season()-crates[i]))
            );
            assetsRemoved.seedsRemoved = assetsRemoved.seedsRemoved.add(crateBdv.mul(s.ss[token].seeds));
        }
        emit TokenRemove(msg.sender, token, crates, amounts, assetsRemoved.tokensRemoved);
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
     * Legacy
     */

    function legacyLPDeposit(address account, uint32 id) public view returns (uint256, uint256) {
       return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]/4);
    }

    function legacyLPWithdrawal(address account, uint32 id) public view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].lp.withdrawals[id];
    }
}
