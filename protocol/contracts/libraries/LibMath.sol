/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibPRBMath.sol";

/**
 * @author Publius
 * @title Lib Math
**/
library LibMath {

    using SafeMath for uint256;

    function sqrt(uint x) internal pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function max(uint256 a, uint256 b) external pure returns (uint256) {
        return a >= b ? a : b;
    }

    function min(uint256 a, uint256 b) external pure returns (uint256) {
        return a <= b ? a : b;
    }

    function nthRoot(uint _a, uint _n) internal pure returns(uint) {
        assert (_n > 1);
        if (_n == 2) return sqrt(_a);
        // The scale factor is a crude way to turn everything into integer calcs.
        // Actually do (a * (10 ^ n)) ^ (1/n)
        uint a0 = 10 ** _n * _a;

        uint xNew = 10;
        uint x;
        while (xNew != x) {
            x = xNew;
            uint t0 = x ** (_n - 1);
            if (x * t0 > a0) {
                xNew = x - (x - a0 / t0) / _n;
            } else {
                xNew = x + (a0 / t0 - x) / _n;
            }
        }

        return (xNew + 5) / 10;
    }

    // Caculates ema at time j given the ema at time i, the balance between and the steepness coefficient a.
    function calcEma(uint256 emaLast, uint256 balLast, uint256 aExp) internal pure returns (uint128 emaNow) {
        // (1-a^(tsNow-tsLast)) * balLast + a^(tsNow-tsLast) * emaLast
        uint256 emaNow256 = LibPRBMath.SCALE.sub(aExp, "aExp too big").mul(balLast).add(aExp.mul(emaLast)).div(LibPRBMath.SCALE);
        require(emaNow256 < type(uint128).max, "Number too big");
        emaNow = uint128(emaNow256);
    }
}