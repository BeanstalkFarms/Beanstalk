/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Bean Silo
**/
library LibBeanSilo {

    using SafeMath for uint256;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);
    event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);

    function addBeanDeposit(address account, uint32 _s, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].bean.deposits[_s] += amount;
        emit BeanDeposit(account, _s, amount);
    }

    function removeBeanDeposit(address account, uint32 id, uint256 amount)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(id <= s.season.current, "Silo: Future crate.");
        uint256 crateAmount = s.a[account].bean.deposits[id];
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        require(crateAmount > 0, "Silo: Crate empty.");
        s.a[account].bean.deposits[id] -= amount;
        return amount;
    }

    function removeBeanDeposits(uint32[] calldata crates, uint256[] calldata amounts)
        internal
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

    function incrementDepositedBeans(uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.bean.deposited = s.bean.deposited.add(amount);
    }

    function decrementDepositedBeans(uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.bean.deposited = s.bean.deposited.sub(amount);
    }
}
