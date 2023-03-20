/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "../AppStorage.sol";
import {BDVFacet} from "~/beanstalk/silo/BDVFacet.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8.
**/

contract InitWhitelist {

    uint32 private constant BEAN_3CRV_STALK = 10000;
    uint32 private constant BEAN_3CRV_SEEDS = 4;

    uint32 private constant BEAN_STALK = 10000; //stalk per bdv (bdv is 6, stalk is 10, so need 4 here)
    uint32 private constant BEAN_SEEDS = 2; //seeds per bdv of bean (1e6 is one bean)

    function whitelistPools() internal {
        whitelistBean3Crv();
        whitelistBean();
        whitelistUnripeBean();
        whitelistUnripeLP();
    }

    function whitelistBean3Crv() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.curveMetapoolAddress(),
            BDVFacet.curveToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS * 1e6 //stalkEarnedPerSeason stored as 1e6, but each old seed yielded 1e4 stalk every season
        );
    }

    function whitelistBean() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.beanAddress(),
            BDVFacet.beanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6
        );
    }

    function whitelistUnripeBean() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.unripeBeanAddress(),
            BDVFacet.unripeBeanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6
        );
    }

    function whitelistUnripeLP() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.unripeLPAddress(),
            BDVFacet.unripeLPToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS * 1e6
        );
    }
}