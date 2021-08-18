/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./SiloEntrance.sol";

/**
 * @author Publius
 * @title LP Silo
**/
contract LPSilo is SiloEntrance {

    struct WithdrawState {
        uint256 newLP;
        uint256 beansAdded;
        uint256 beansTransferred;
        uint256 beansRemoved;
        uint256 stalkRemoved;
        uint256 i;
    }

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

    function lpDeposit(address account, uint32 id) public view returns (uint256, uint256) {
        return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]);
    }

    function lpWithdrawal(address account, uint32 i) public view returns (uint256) {
        return s.a[account].lp.withdrawals[i];
    }

    /**
     * Internal
    **/

    function _depositLP(uint256 amount, uint32 _s) internal {
        updateSilo(msg.sender);
        uint256 lpb = lpToLPBeans(amount);
        require(lpb > 0, "Silo: No Beans under LP.");
        incrementDepositedLP(amount);
        uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
        if (season() == _s) depositSiloAssets(msg.sender, seeds, lpb.mul(10000));
        else depositSiloAssets(msg.sender, seeds, lpb.mul(10000).add(season().sub(_s).mul(seeds)));

        addLPDeposit(msg.sender, _s, amount, lpb.mul(C.getSeedsPerLPBean()));

        LibCheck.lpBalanceCheck();
    }

    function _withdrawLP(uint32[] calldata crates, uint256[] calldata amounts) internal {
        updateSilo(msg.sender);
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        (
            uint256 lpRemoved,
            uint256 stalkRemoved,
            uint256 seedsRemoved
        ) = removeLPDeposits(crates, amounts);
        uint32 arrivalSeason = season() + C.getSiloWithdrawSeasons();
        addLPWithdrawal(msg.sender, arrivalSeason, lpRemoved);
        decrementDepositedLP(lpRemoved);
        withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        updateBalanceOfRainStalk(msg.sender);

        LibCheck.lpBalanceCheck();
    }

    function incrementDepositedLP(uint256 amount) private {
        s.lp.deposited = s.lp.deposited.add(amount);
    }

    function decrementDepositedLP(uint256 amount) private {
        s.lp.deposited = s.lp.deposited.sub(amount);
    }

    function addLPDeposit(address account, uint32 _s, uint256 amount, uint256 seeds) private {
        s.a[account].lp.deposits[_s] += amount;
        s.a[account].lp.depositSeeds[_s] += seeds;
        emit LPDeposit(msg.sender, _s, amount, seeds);
    }

    function removeLPDeposits(uint32[] calldata crates, uint256[] calldata amounts)
        private
        returns (uint256 lpRemoved, uint256 stalkRemoved, uint256 seedsRemoved)
    {
        for (uint256 i = 0; i < crates.length; i++) {
            (uint256 crateBeans, uint256 crateSeeds) = removeLPDeposit(
                msg.sender,
                crates[i],
                amounts[i]
            );
            lpRemoved = lpRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateSeeds.mul(C.getStalkPerLPSeed()).add(
                stalkReward(crateSeeds, season()-crates[i]))
            );
            seedsRemoved = seedsRemoved.add(crateSeeds);
        }
        emit LPRemove(msg.sender, crates, amounts, lpRemoved);
    }

    function removeLPDeposit(address account, uint32 id, uint256 amount)
        private
        returns (uint256, uint256) {
        require(id <= season(), "Silo: Future crate.");
        (uint256 crateAmount, uint256 crateBase) = lpDeposit(account, id);
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        require(crateAmount > 0, "Silo: Crate empty.");
        if (amount < crateAmount) {
            uint256 base = amount.mul(crateBase).div(crateAmount);
            s.a[account].lp.deposits[id] -= amount;
            s.a[account].lp.depositSeeds[id] -= base;
            return (amount, base);
        } else {
            delete s.a[account].lp.deposits[id];
            delete s.a[account].lp.depositSeeds[id];
            return (crateAmount, crateBase);
        }
    }

    function addLPWithdrawal(address account, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].lp.withdrawals[arrivalSeason] = s.a[account].lp.withdrawals[arrivalSeason].add(amount);
        s.lp.withdrawn = s.lp.withdrawn.add(amount);
        emit LPWithdraw(msg.sender, arrivalSeason, amount);
    }
    
}
