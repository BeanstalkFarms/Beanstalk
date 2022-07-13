/*
 SPDX-License-Identifier: MIT
*/

import "../MockToken.sol";
import "../../interfaces/ICurve.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


contract MockCurveZap {

    address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address private constant BEAN = 0xBEA0003eA948Db32082Fc6F4EC0729D258a0444c;
    address private constant THREE_CURVE = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;
    address private constant THREE_POOL = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    address private constant BEAN_METAPOOL = 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49;

    function approve() external {
        IERC20(BEAN).approve(BEAN_METAPOOL, type(uint256).max);
        IERC20(THREE_CURVE).approve(BEAN_METAPOOL, type(uint256).max);
    }

    function add_liquidity(address pool, uint256[4] memory depAmounts, uint256 minOut) external returns (uint256) {
        IERC20(BEAN).transferFrom(msg.sender, address(this), depAmounts[0]);
        IERC20(USDC).transferFrom(msg.sender, THREE_POOL, depAmounts[2]);
        uint256 threeCrvAmount = depAmounts[2] * I3Curve(THREE_POOL).get_virtual_price() / 1e6;
        MockToken(THREE_CURVE).mint(address(this), threeCrvAmount);
        return ICurvePool2R(pool).add_liquidity([depAmounts[0], threeCrvAmount], minOut, msg.sender);
    }
}