/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./LPSilo.sol";

/**
 * @author Publius
 * @title Bean Silo
**/
contract BeanSilo is LPSilo {

    using SafeMath for uint256;
    using SafeMath for uint32;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);
    event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);
    event BeanWithdraw(address indexed account, uint256 season, uint256 beans);

    /**
     * Getters
    **/

    function totalDepositedBeans() public view returns (uint256) {
            return s.bean.deposited;
    }

    function totalWithdrawnBeans() public view returns (uint256) {
            return s.bean.withdrawn;
    }

    function beanDeposit(address account, uint32 id) public view returns (uint256) {
        return s.a[account].bean.deposits[id];
    }

    function beanWithdrawal(address account, uint32 i) public view returns (uint256) {
            return s.a[account].bean.withdrawals[i];
    }

    /**
     * Internal
    **/

    function _depositBeans(uint256 amount, uint32 _s) internal {
        require(amount > 0, "Silo: No beans.");
        updateSilo(msg.sender);
        LibBeanSilo.incrementDepositedBeans(amount);
        LibSilo.depositSiloAssets(msg.sender, amount.mul(C.getSeedsPerBean()), amount.mul(C.getStalkPerBean()));
        LibBeanSilo.addBeanDeposit(msg.sender, season(), amount);
    }

    function _withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts
    )
        internal
    {
        updateSilo(msg.sender);
        require(crates.length == amounts.length, "Silo: Crates, amounts are diff lengths.");
        (uint256 beansRemoved, uint256 stalkRemoved) = removeBeanDeposits(crates, amounts);
        addBeanWithdrawal(msg.sender, season()+s.season.withdrawBuffer, beansRemoved);
        LibBeanSilo.decrementDepositedBeans(beansRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
        LibSilo.updateBalanceOfRainStalk(msg.sender);
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

    function removeBeanDeposits(uint32[] calldata crates, uint256[] calldata amounts)
        private
        returns (uint256 beansRemoved, uint256 stalkRemoved)
    {
        for (uint256 i = 0; i < crates.length; i++) {
            uint256 crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, crates[i], amounts[i]);
            beansRemoved = beansRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateBeans.mul(C.getStalkPerBean()).add(
                LibSilo.stalkReward(crateBeans.mul(C.getSeedsPerBean()), season()-crates[i]))
            );
        }
        emit BeanRemove(msg.sender, crates, amounts, beansRemoved);
    }

    function addBeanWithdrawal(address account, uint32 arrivalSeason, uint256 amount) private {
        s.a[account].bean.withdrawals[arrivalSeason] = s.a[account].bean.withdrawals[arrivalSeason].add(amount);
        s.bean.withdrawn = s.bean.withdrawn.add(amount);
        emit BeanWithdraw(msg.sender, arrivalSeason, amount);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }

}
