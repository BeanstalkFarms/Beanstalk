/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

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
        addBean3CrvStatus();
        addUnripeBeanStatus();
        addUnripeLPStatus();
    }

    function addBean3CrvStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(
            C.CURVE_BEAN_METAPOOL,
            true,
            true,
            false
        );
    }

    function addBeanStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(
            C.BEAN,
            true,
            false,
            false
        );
    }

    function addUnripeBeanStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(
            C.UNRIPE_BEAN,
            true,
            false,
            false
        );
    }

    function addUnripeLPStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(
            C.UNRIPE_LP,
            true,
            false,
            false
        );
    }

    function addBeanEthStatus() internal {
        LibWhitelistedTokens.addWhitelistStatus(
            C.BEAN_ETH_WELL,
            true,
            true,
            true
        );
    }
}