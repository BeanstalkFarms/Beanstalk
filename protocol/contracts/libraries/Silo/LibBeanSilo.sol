/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
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

    function incrementDepositedBeans(uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.bean.deposited = s.bean.deposited.add(amount);
    }

    function decrementDepositedBeans(uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.bean.deposited = s.bean.deposited.sub(amount);
    }
}
