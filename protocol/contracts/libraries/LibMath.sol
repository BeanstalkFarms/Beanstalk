/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import "./LibPRBMath60x18.sol";

/**
 * @author Publius
 * @title Lib Math
**/
library LibMath {

    using SafeMath for uint256;
    using SafeCast for uint256;

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
        uint256 emaNow256 = LibPRBMath60x18.SCALE.sub(aExp, "aExp too big").mul(balLast).add(aExp.mul(emaLast)).div(LibPRBMath60x18.SCALE);
        require(emaNow256 < type(uint128).max, "Number too big");
        emaNow = uint128(emaNow256);
    }

    function calcGeometricEma(uint256 emaLast, uint256 balLast, uint256 aExp) internal pure returns (uint128 emaNow) {
        uint256 exponent = LibPRBMath60x18.SCALE.sub(aExp, "aExp too big").mul(log_two(balLast)).add(
            aExp.mul(log_two(emaLast))
        ).div(LibPRBMath60x18.SCALE);
        return (LibPRBMath60x18.exp2(exponent)).toUint128();
    }

    /// @notice log_two calculates the log2 solution in a gas efficient manner
    /// Motivation: https://ethereum.stackexchange.com/questions/8086
    /// @param x - the base to calculate log2 of
    function log_two(uint256 x) internal pure returns (uint256 y) {
        assembly {
            let arg := x
            x := sub(x, 1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            let m := mload(0x40)
            mstore(
                m,
                0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd
            )
            mstore(
                add(m, 0x20),
                0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe
            )
            mstore(
                add(m, 0x40),
                0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616
            )
            mstore(
                add(m, 0x60),
                0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff
            )
            mstore(
                add(m, 0x80),
                0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e
            )
            mstore(
                add(m, 0xa0),
                0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707
            )
            mstore(
                add(m, 0xc0),
                0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606
            )
            mstore(
                add(m, 0xe0),
                0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100
            )
            mstore(0x40, add(m, 0x100))
            let
                magic
            := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let
                shift
            := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(x, magic), shift)
            y := div(mload(add(m, sub(255, a))), shift)
            y := add(
                y,
                mul(
                    256,
                    gt(
                        arg,
                        0x8000000000000000000000000000000000000000000000000000000000000000
                    )
                )
            )
        }
    }
}