/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brendan
 * @title Initializes the whitelist statuses for Whitelisted Beanstalk Assets before Whitelisted Statuses were introduced.
 **/

contract InitWhitelistStatuses {
    function addWhitelistStatuses(bool beanEth) internal {
        addBeanStatus();
        if (beanEth) addBeanEthStatus();
        addUnripeBeanStatus();
        addUnripeLPStatus();
    }

    function addBeanStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(C.BEAN, true, false, false, false);
    }

    function addUnripeBeanStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(C.UNRIPE_BEAN, true, false, false, false);
    }

    function addUnripeLPStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(C.UNRIPE_LP, true, false, false, false);
    }

    function addBeanEthStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(C.BEAN_ETH_WELL, true, true, true, true);
    }
}
