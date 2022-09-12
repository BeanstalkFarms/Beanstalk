/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

/**
 * @author Publius
 * @title InitBip22 runs the code for BIP-22. 
 * It mints Beans to the Beanstalk Farms Multi-Sig in accordance with the proposed Q3 budget.
 **/
contract InitBip22 {
    address private constant beanstalkFarms =
        0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7;
    uint256 private constant beanstalkFarmsBudget = 500_000 * 1e6; // 500,000 Beans

    function init() external {
        C.bean().mint(beanstalkFarms, beanstalkFarmsBudget);
    }
}
