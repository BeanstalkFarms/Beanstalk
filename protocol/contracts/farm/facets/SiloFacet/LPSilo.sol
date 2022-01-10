/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./UpdateSilo.sol";
import "../../../libraries/Silo/LibLPSilo.sol";

/**
 * @author Publius
 * @title LP Silo
**/
contract LPSilo is UpdateSilo {

    using SafeMath for uint256;
    using SafeMath for uint32;

    event LPDeposit(address indexed account, uint256 season, uint256 lp, uint256 seeds);
    event LPRemove(address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);
    event LPWithdraw(address indexed account, uint256 season, uint256 lp);

    /**
     * Getters
    **/

    function totalDepositedLP() public view returns (uint256) {
            return s.lp.deposited;
    }

    function totalWithdrawnLP() public view returns (uint256) {
            return s.lp.withdrawn;
    }

    function lpDeposit(address account, uint32 id, address lp_address) public view returns (uint256, uint256) {
        return (s.a[account].deposits[IERC20(lp_address)][id].tokens, s.a[account].deposits[IERC20(lp_address)][id].seeds);
    }

    function lpWithdrawal(address account, uint32 i, address lp_address) public view returns (uint256) {
        return s.a[account].withdrawals[IERC20(lp_address)][i];
    }

    // V2 For All LP Pool Types and Addresses
    function totalDepositedLPByPool(address lp_address) public view returns (uint256) {
            return s.lp_balances[IERC20(lp_address)].deposited;
    }

    function totalWithdrawnLPByPool(address lp_address) public view returns (uint256) {
            return s.lp_balances[IERC20(lp_address)].withdrawn;
    }

    /**
     * Internal
    **/

    function _depositLP(uint256 amount, address lp_address) internal {
        updateSilo(msg.sender);
        uint32 _s = season();
        uint256 lpb = LibLPSilo.lpToLPBeans(amount);
        require(lpb > 0, "Silo: No Beans under LP.");
        LibLPSilo.incrementDepositedLP(amount, lp_address);
        uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
        if (season() == _s) LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000));
        else LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(10000).add(season().sub(_s).mul(seeds)));

        LibLPSilo.addLPDeposit(msg.sender, _s, amount, lpb.mul(C.getSeedsPerLPBean()), lp_address);
        
        // Must rewrite this to take into account different lp pools
        LibCheck.lpBalanceCheck();
    }

    function _withdrawLP(uint32[] calldata crates, uint256[] calldata amounts, address lp_address) internal {
        updateSilo(msg.sender);
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        (
            uint256 lpRemoved,
            uint256 stalkRemoved,
            uint256 seedsRemoved
        ) = removeLPDeposits(crates, amounts, lp_address);
        uint32 arrivalSeason = season() + s.season.withdrawBuffer;
        addLPWithdrawal(msg.sender, arrivalSeason, lpRemoved, lp_address);
        LibLPSilo.decrementDepositedLP(lpRemoved, lp_address);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);

        // Need to generalize this LibCheck function possibly using function selectors
        LibCheck.lpBalanceCheck();
    }

    function removeLPDeposits(uint32[] calldata crates, uint256[] calldata amounts, address lp_address)
        private
        returns (uint256 lpRemoved, uint256 stalkRemoved, uint256 seedsRemoved)
    {
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateSeeds) = LibLPSilo.removeLPDeposit(
                msg.sender,
                crates[i],
                amounts[i],
                lp_address
            );
            lpRemoved = lpRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateSeeds.mul(C.getStalkPerLPSeed()).add(
                LibSilo.stalkReward(crateSeeds, season()-crates[i]))
            );
            seedsRemoved = seedsRemoved.add(crateSeeds);
        }
        emit LPRemove(msg.sender, crates, amounts, lpRemoved);
    }

    function addLPWithdrawal(address account, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].lp.withdrawals[arrivalSeason] = s.a[account].lp.withdrawals[arrivalSeason].add(amount);
        s.lp.withdrawn = s.lp.withdrawn.add(amount);
        emit LPWithdraw(msg.sender, arrivalSeason, amount);
    }

    function addLPWithdrawal(address account, uint32 arrivalSeason, uint256 amount, address lp_address) private {
        s.a[account].withdrawals[IERC20(lp_address)][arrivalSeason] = s.a[account].lp.withdrawals[arrivalSeason].add(amount);
        s.lp_balances[IERC20(lp_address)].withdrawn = s.lp_balances[IERC20(lp_address)].withdrawn.add(amount);
        emit LPWithdraw(msg.sender, arrivalSeason, amount);
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }
}
