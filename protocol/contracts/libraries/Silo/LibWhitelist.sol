/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

/**
 * @author Publius
 * @title LibWhitelist handles the whitelisting of different tokens.
**/

interface IBS {
    function whitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external;
    function lusdToBDV(uint256 amount) external view returns (uint256);
    function curveToBDV(uint256 amount) external view returns (uint256);
    function beanToBDV(uint256 amount) external view returns (uint256);
    function unripeBeanToBDV(uint256 amount) external view returns (uint256);
    function unripeLPToBDV(uint256 amount) external view returns (uint256);
}

library LibWhitelist {

    uint32 private constant BEAN_LUSD_STALK = 10000;
    uint32 private constant BEAN_LUSD_SEEDS = 3;

    uint32 private constant BEAN_3CRV_STALK = 10000;
    uint32 private constant BEAN_3CRV_SEEDS = 4;

    uint32 private constant BEAN_STALK = 10000;
    uint32 private constant BEAN_SEEDS = 2;


    function whitelistPools() internal {
        whitelistBeanLusd();
        whitelistBean3Crv();
        whitelistBean();
        whitelistUnripeBean();
        whitelistUnripeLP();
    }

    function whitelistBeanLusd() internal {
        IBS(address(this)).whitelistToken(C.curveBeanLUSDAddress(), IBS.lusdToBDV.selector, BEAN_LUSD_STALK, BEAN_LUSD_SEEDS);
    }

    function whitelistBean3Crv() internal {
        IBS(address(this)).whitelistToken(C.curveMetapoolAddress(), IBS.curveToBDV.selector, BEAN_3CRV_STALK, BEAN_3CRV_SEEDS);
    }

    function whitelistBean() internal {
        IBS(address(this)).whitelistToken(C.beanAddress(), IBS.beanToBDV.selector, BEAN_STALK, BEAN_SEEDS);
    }

    function whitelistUnripeBean() internal {
        IBS(address(this)).whitelistToken(C.unripeBeanAddress(), IBS.unripeBeanToBDV.selector, BEAN_STALK, BEAN_SEEDS);
    }

    function whitelistUnripeLP() internal {
        IBS(address(this)).whitelistToken(C.unripeLPAddress(), IBS.unripeLPToBDV.selector, BEAN_3CRV_STALK, BEAN_3CRV_SEEDS);
    }
}