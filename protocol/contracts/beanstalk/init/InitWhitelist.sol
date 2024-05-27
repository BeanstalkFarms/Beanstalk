/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "contracts/libraries/Silo/LibLegacyWhitelist.sol";
import {AppStorage} from "../storage/AppStorage.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8.
 **/

contract InitWhitelist {
    uint32 private constant LP_STALK = 10000;
    uint32 private constant LP_SEEDS = 4;

    uint32 private constant BEAN_STALK = 10000; //stalk per bdv (bdv is 6, stalk is 10, so need 4 here)
    uint32 private constant BEAN_SEEDS = 2; //seeds per bdv of bean (1e6 is one bean)

    function whitelistPools() internal {
        whitelistBean();
        whitelistUnripeBean();
        whitelistUnripeLP();
    }

    function whitelistBean() internal {
        LibLegacyWhitelist.whitelistToken(
            C.BEAN,
            BDVFacet.beanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6
        );
    }

    function whitelistUnripeBean() internal {
        LibLegacyWhitelist.whitelistToken(
            C.UNRIPE_BEAN,
            BDVFacet.unripeBeanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6
        );
    }

    function whitelistUnripeLP() internal {
        LibLegacyWhitelist.whitelistToken(
            C.UNRIPE_LP,
            BDVFacet.unripeLPToBDV.selector,
            LP_STALK,
            LP_SEEDS * 1e6
        );
    }
}
