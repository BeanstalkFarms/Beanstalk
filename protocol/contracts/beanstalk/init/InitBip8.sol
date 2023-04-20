/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";
import "~/C.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8. It mints Beans to the Q1 2022 budget multi-sigs and marks them as budget contracts.
**/
contract InitBip8 {

    AppStorage internal s;
    
    // To Do: Set Budget Addresses
    address private constant beanSprout = address(0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235);
    address private constant beanstalkFarms = address(0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7);

    uint256 private constant beanSproutBudget = 800000 * 1e6; // 800,000 Beans
    uint256 private constant beanstalkFarmsBudget = 1200000 * 1e6; // 1,200,000 Beans

    function init() external {
        s.deprecated_isBudget[beanSprout] = true;
        s.deprecated_isBudget[beanstalkFarms] = true;
        C.bean().mint(beanSprout, beanSproutBudget);
        C.bean().mint(beanstalkFarms, beanstalkFarmsBudget);
    }
}