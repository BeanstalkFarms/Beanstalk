/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title LibWhitelist handles the whitelisting of different tokens.
 **/

interface IBS {
    function lusdToBDV(uint256 amount) external view returns (uint256);

    function curveToBDV(uint256 amount) external view returns (uint256);

    function beanToBDV(uint256 amount) external pure returns (uint256);

    function unripeBeanToBDV(uint256 amount) external view returns (uint256);

    function unripeLPToBDV(uint256 amount) external view returns (uint256);
}

library LibWhitelist {

    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint256 seeds,
        uint256 stalk
    );

    event DewhitelistToken(address indexed token);

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
        whitelistToken(
            C.CURVE_BEAN_METAPOOL,
            IBS.curveToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS
        );
    }

    function whitelistBean() internal {
        whitelistToken(
            C.BEAN,
            IBS.beanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS
        );
    }

    function whitelistUnripeBean() internal {
        whitelistToken(
            C.UNRIPE_BEAN,
            IBS.unripeBeanToBDV.selector,
            BEAN_STALK,
            BEAN_SEEDS
        );
    }

    function whitelistUnripeLP() internal {
        whitelistToken(
            C.UNRIPE_LP,
            IBS.unripeLPToBDV.selector,
            BEAN_3CRV_STALK,
            BEAN_3CRV_SEEDS
        );
    }

    function dewhitelistToken(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        delete s.ss[token];
        emit DewhitelistToken(token);
    }

    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalk,
        uint32 seeds
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.ss[token].selector = selector;
        s.ss[token].stalk = stalk;
        s.ss[token].seeds = seeds;

        emit WhitelistToken(token, selector, stalk, seeds);
    }
}
