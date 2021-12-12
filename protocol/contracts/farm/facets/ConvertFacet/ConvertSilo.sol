/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../SiloFacet/SiloEntrance.sol";

/**
 * @author Publius
 * @title Bean Silo
**/
contract ConvertSilo is SiloEntrance {

    using SafeMath for uint256;
    using SafeMath for uint32;
    
    event LPDeposit(address indexed account, uint256 season, uint256 lp, uint256 seeds);
    event LPRemove(address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);
    event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);

    struct WithdrawState {
        uint256 newLP;
        uint256 beansAdded;
        uint256 beansTransferred;
        uint256 beansRemoved;
        uint256 stalkRemoved;
        uint256 i;
    }

    /**
     * Internal LP
    **/

    function _depositLP(uint256 amount, uint256 lpb, uint32 _s) internal {
        require(lpb > 0, "Silo: No Beans under LP.");
        incrementDepositedLP(amount);
        uint256 seeds = lpb.mul(C.getSeedsPerLPBean());
        if (season() == _s) depositSiloAssets(msg.sender, seeds, lpb.mul(10000));
        else depositSiloAssets(msg.sender, seeds, lpb.mul(10000).add(season().sub(_s).mul(seeds)));

        addLPDeposit(msg.sender, _s, amount, lpb.mul(C.getSeedsPerLPBean()));

        LibCheck.lpBalanceCheck();
    }

    function incrementDepositedLP(uint256 amount) private {
        s.lp.deposited = s.lp.deposited.add(amount);
    }

    function addLPDeposit(address account, uint32 _s, uint256 amount, uint256 seeds) private {
        s.a[account].lp.deposits[_s] += amount;
        s.a[account].lp.depositSeeds[_s] += seeds;
        emit LPDeposit(msg.sender, _s, amount, seeds);
    }

    function _withdrawLPForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxLP
    )
        internal
        returns (uint256 lpRemoved, uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 seedsRemoved;
        uint256 depositLP;
        uint256 depositSeeds;
        uint256 i = 0;
        while ((i < crates.length) && (lpRemoved < maxLP)) {
            if (lpRemoved.add(amounts[i]) < maxLP)
                (depositLP, depositSeeds) = removeLPDeposit(msg.sender, crates[i], amounts[i]);
            else
                (depositLP, depositSeeds) = removeLPDeposit(msg.sender, crates[i], maxLP.sub(lpRemoved));
            lpRemoved = lpRemoved.add(depositLP);
            seedsRemoved = seedsRemoved.add(depositSeeds);
            stalkRemoved = stalkRemoved.add(depositSeeds.mul(C.getStalkPerLPSeed()).add(
                stalkReward(depositSeeds, season()-crates[i]
            )));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositLP;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        decrementDepositedLP(lpRemoved);
        withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        stalkRemoved = stalkRemoved.sub(seedsRemoved.mul(C.getStalkPerLPSeed()));
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

    function decrementDepositedLP(uint256 amount) private {
        s.lp.deposited = s.lp.deposited.sub(amount);
    }

    function lpDeposit(address account, uint32 id) internal view returns (uint256, uint256) {
        return (s.a[account].lp.deposits[id], s.a[account].lp.depositSeeds[id]);
    }

    /**
     * Internal Bean
    **/

    function _depositBeans(uint256 amount, uint32 _s) internal {
        require(amount > 0, "Silo: No beans.");
        incrementDepositedBeans(amount);
        uint256 stalk = amount.mul(C.getStalkPerBean());
        uint256 seeds = amount.mul(C.getSeedsPerBean());
        if (_s < season()) stalk = stalk.add(stalkReward(seeds, season()-_s));
        depositSiloAssets(msg.sender, seeds, stalk);
        addBeanDeposit(msg.sender, _s, amount);
        LibCheck.beanBalanceCheck();
    }

    function _withdrawBeansForConvert(
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 maxBeans
    )
        internal
        returns (uint256 beansRemoved, uint256 stalkRemoved)
    {
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        uint256 crateBeans;
        uint256 i = 0;
        while ((i < crates.length) && (beansRemoved < maxBeans)) {
            if (beansRemoved.add(amounts[i]) < maxBeans)
                crateBeans = removeBeanDeposit(msg.sender, crates[i], amounts[i]);
            else
                crateBeans = removeBeanDeposit(msg.sender, crates[i], maxBeans.sub(beansRemoved));
            beansRemoved = beansRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateBeans.mul(C.getStalkPerBean()).add(
                stalkReward(crateBeans.mul(C.getSeedsPerBean()), season()-crates[i]
            )));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = crateBeans;
        while (i < crates.length) {
            amounts[i] = 0;
            i++;
        }
        decrementDepositedBeans(beansRemoved);
        withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
        stalkRemoved = stalkRemoved.sub(beansRemoved.mul(C.getStalkPerBean()));
        emit BeanRemove(msg.sender, crates, amounts, beansRemoved);
        return (beansRemoved, stalkRemoved);
    }

    function removeBeanDeposit(address account, uint32 id, uint256 amount)
        private
        returns (uint256)
    {
        require(id <= season(), "Silo: Future crate.");
        uint256 crateAmount = beanDeposit(account, id);
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        require(crateAmount > 0, "Silo: Crate empty.");
        s.a[account].bean.deposits[id] -= amount;
        return amount;
    }

    function decrementDepositedBeans(uint256 amount) private {
        s.bean.deposited = s.bean.deposited.sub(amount);
    }

    function beanDeposit(address account, uint32 id) private view returns (uint256) {
        return s.a[account].bean.deposits[id];
    }
}
