/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/libraries/Silo/LibLegacyWhitelist.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8.
**/

interface IBS {
    function lusdToBDV(uint256 amount) external view returns (uint256);

    function curveToBDV(uint256 amount) external view returns (uint256);

    function beanToBDV(uint256 amount) external pure returns (uint256);

    function unripeBeanToBDV(uint256 amount) external view returns (uint256);

    function unripeLPToBDV(uint256 amount) external view returns (uint256);
}

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
        LibLegacyWhitelist.whitelistToken(
            C.CURVE_BEAN_METAPOOL,
            IBS.curveToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS * 1e6 //stalkEarnedPerSeason stored as 1e6, but each old seed yielded 1e4 stalk every season
        );
    }

    function whitelistBean() internal {
        LibLegacyWhitelist.whitelistToken(
            C.BEAN,
            IBS.beanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6
        );
    }

    function whitelistUnripeBean() internal {
        LibLegacyWhitelist.whitelistToken(
            C.UNRIPE_BEAN,
            IBS.unripeBeanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6
        );
    }

    function whitelistUnripeLP() internal {
        LibLegacyWhitelist.whitelistToken(
            C.UNRIPE_LP,
            IBS.unripeLPToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS * 1e6
        );
    }
}