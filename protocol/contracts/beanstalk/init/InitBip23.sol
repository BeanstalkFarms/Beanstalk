/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

/**
 * @author Publius
 * @title InitBip23 runs the code for BIP-23. 
 * It mints Beans to the Bean Sprout Multi-Sig in accordance with the proposed Q3 budget.
 **/
contract InitBip23 {
    address private constant beanSprout =
        0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235;
    uint256 private constant beanSproutBudget = 150_000 * 1e6; // 150,000 Beans

    function init() external {
        IBean(C.bean()).mint(beanSprout, beanSproutBudget);
    }
}
