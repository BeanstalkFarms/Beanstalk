/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./UpdateSilo.sol";
import "../../../libraries/Silo/LibLPSilo.sol";
import "../../../libraries/LibBeanEthUniswap.sol";

/**
 * @author Publius
 * @title LP Silo
**/
contract LPSilo is UpdateSilo {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

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

    function lpDeposit(address account, uint32 id) public view returns (uint256, uint256) {
        return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]);
    }

    function lpWithdrawal(address account, uint32 i) public view returns (uint256) {
        return s.a[account].lp.withdrawals[i];
    }

    /**
     * Internal
    **/

    function _depositLP(uint256 amount) internal {
        uint256 lpb = LibBeanEthUniswap.bdv(amount);
        require(lpb > 0, "Silo: No Beans under LP.");
        LibLPSilo.incrementDepositedLP(amount);
        uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
        LibSilo.depositSiloAssets(msg.sender, seeds, lpb.mul(C.getStalkPerBean()));
        LibLPSilo.addLPDeposit(msg.sender, season(), amount, seeds);

        LibCheck.lpBalanceCheck();
    }

    function _withdrawLP(uint32[] calldata crates, uint256[] calldata amounts) internal {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        (
            uint256 lpRemoved,
            uint256 stalkRemoved,
            uint256 seedsRemoved
        ) = removeLPDeposits(crates, amounts);
        uint32 arrivalSeason = season() + s.season.withdrawSeasons;
        addLPWithdrawal(msg.sender, arrivalSeason, lpRemoved);
        LibLPSilo.decrementDepositedLP(lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);

        LibCheck.lpBalanceCheck();
    }

    function removeLPDeposits(uint32[] calldata crates, uint256[] calldata amounts)
        private
        returns (uint256 lpRemoved, uint256 stalkRemoved, uint256 seedsRemoved)
    {
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateSeeds) = LibLPSilo.removeLPDeposit(
                msg.sender,
                crates[i],
                amounts[i]
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

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }
}
