/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibCurve.sol";

interface I3Curve {
    function get_virtual_price() external view returns (uint256);
}

interface IMeta3Curve {
    function A_precise() external view returns (uint256);
    function get_previous_balances() external view returns (uint256[2] memory);
    function get_virtual_price() external view returns (uint256);
}

library LibMetaCurve {
    using SafeMath for uint256;

    uint256 private constant A_PRECISION = 100;
    address private constant CRV3_POOL = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    uint256 private constant N_COINS  = 2;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant STEP = 1e6;
    uint256 private constant MAX_DECIMALS = 18;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    function price(address pool, uint256 decimals) internal view returns (uint256 price) {
        uint256 a = IMeta3Curve(pool).A_precise();
        uint256[2] memory balances = IMeta3Curve(pool).get_previous_balances();
        uint256[2] memory xp = getXP(balances, 10 ** MAX_DECIMALS.sub(decimals));
        uint256 D =  LibCurve.getD(xp, a);
        price = LibCurve.getPrice(xp, a, D, 10**decimals);
    }

    function getXP(uint256[2] memory balances, uint256 padding) internal view returns (uint256[2] memory xp) {
        xp = LibCurve.getXP(balances, padding, I3Curve(CRV3_POOL).get_virtual_price());
    }
}
