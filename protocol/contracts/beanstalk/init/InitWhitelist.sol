/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Silo/LibWhitelist.sol";
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

    uint32 private constant BEAN_STALK = 10000;
    uint32 private constant BEAN_SEEDS = 2;

    function whitelistPools() internal {
        whitelistBean3Crv();
        whitelistBean();
        whitelistUnripeBean();
        whitelistUnripeLP();
    }

    function whitelistBean3Crv() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.curveMetapoolAddress(),
            IBS.curveToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS * 1e6 * 1e4, //stalkPerBdvPerSeason stored as 1e6, but each old seed yielded 1e4 stalk every season
            BEAN_3CRV_SEEDS
        );
    }

    function whitelistBean() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.beanAddress(),
            IBS.beanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6 * 1e4,
            BEAN_SEEDS
        );
    }

    function whitelistUnripeBean() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.unripeBeanAddress(),
            IBS.unripeBeanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS * 1e6 * 1e4,
            BEAN_SEEDS
        );
    }

    function whitelistUnripeLP() internal {
        LibWhitelist.whitelistTokenLegacy(
            C.unripeLPAddress(),
            IBS.unripeLPToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS * 1e6 * 1e4,
            BEAN_3CRV_SEEDS
        );
    }
}