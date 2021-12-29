/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";
import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8. It mints Beans to the Q1 2022 budget multi-sigs and marks them as budget contracts.
**/
contract InitBip8 {

    AppStorage internal s;
    
    // To Do: Set Budget Addresses
    address private constant beanSprout = address(0x0000000000000000000000000000000000000000);
    address private constant beanstalkFarms = address(0x0000000000000000000000000000000000000000);

    uint256 private constant beanSproutBudget = 800000 * 1e6; // 800,000 Beans
    uint256 private constant beanstalkFarmsBudget = 1200000 * 1e6; // 1,200,000 Beans

    function init() external {
        s.isBudget[beanSprout] = true;
        s.isBudget[beanstalkFarms] = true;
        IBean(s.c.bean).mint(beanSprout, beanSproutBudget);
        IBean(s.c.bean).mint(beanstalkFarms, beanstalkFarmsBudget);
    }
}