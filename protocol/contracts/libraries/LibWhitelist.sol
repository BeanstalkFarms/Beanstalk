/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";

/**
 * @author Publius
 * @title InitBip16 initializes BIP-16: It whitelists the Bean:LUSD Curve Plain Pool into the Silo and pays the publius address 5,000 Beans.
**/

interface IBS {
    function whitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external;
    function lusdToBDV(uint256 amount) external view returns (uint256);
    function curveToBDV(uint256 amount) external view returns (uint256);
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
    }

    function whitelistBeanLusd() internal {
        IBS(address(this)).whitelistToken(C.curveBeanLUSDAddress(), IBS.lusdToBDV.selector, BEAN_LUSD_STALK, BEAN_LUSD_SEEDS);
    }

    function whitelistBean3Crv() internal {
        IBS(address(this)).whitelistToken(C.curveMetapoolAddress(), IBS.curveToBDV.selector, BEAN_3CRV_STALK, BEAN_3CRV_SEEDS);
    }

    function whitelistBean() internal {
        IBS(address(this)).whitelistToken(C.beanAddress(), bytes4(0), BEAN_STALK, BEAN_SEEDS);
    }
}