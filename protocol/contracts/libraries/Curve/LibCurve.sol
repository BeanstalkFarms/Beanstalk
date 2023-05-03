// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title LibCurve
 * @author Publius
 * @notice Low-level Curve swap math for a 2-token StableSwap pool.
 */
library LibCurve {
    using SafeMath for uint256;

    uint256 private constant A_PRECISION = 100;
    uint256 private constant N_COINS = 2;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    /**
     * @dev Find the change in token `j` given a change in token `i`.
     */
    function getPrice(
        uint256[2] memory xp,
        uint256 a,
        uint256 D,
        uint256 padding
    ) internal pure returns (uint256) {
        uint256 x = xp[i] + padding;
        uint256 y = getY(x, xp, a, D);
        uint256 dy = xp[j] - y - 1;
        return dy;
    }

    function getPrice(
        uint256[2] memory xp,
        uint256[2] memory rates,
        uint256 a,
        uint256 D
    ) internal pure returns (uint256) {
        uint256 x = xp[i] + ((1 * rates[i]) / PRECISION);
        uint256 y = getY(x, xp, a, D);
        uint256 dy = xp[j] - y - 1;
        return dy / 1e6;
    }

    function getY(
        uint256 x,
        uint256[2] memory xp,
        uint256 a,
        uint256 D
    ) internal pure returns (uint256 y) {
        // Solution is taken from pool contract: 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49
        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 c = D;
        uint256 Ann = a * N_COINS;

        for (uint256 _i; _i < N_COINS; ++_i) {
            if (_i == i) _x = x;
            else if (_i != j) _x = xp[_i];
            else continue;
            S_ += _x;
            c = (c * D) / (_x * N_COINS);
        }

        c = (c * D * A_PRECISION) / (Ann * N_COINS);
        uint256 b = S_ + (D * A_PRECISION) / Ann; // - D
        y = D;

        for (uint256 _i; _i < 255; ++_i) {
            y_prev = y;
            y = (y * y + c) / (2 * y + b - D);
            if (y > y_prev && y - y_prev <= 1) return y;
            else if (y_prev - y <= 1) return y;
        }
        require(false, "Price: Convergence false");
    }

    function getD(uint256[2] memory xp, uint256 a)
        internal
        pure
        returns (uint256 D)
    {
        // Solution is taken from pool contract: 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49
        uint256 S;
        uint256 Dprev;
        for (uint256 _i; _i < xp.length; ++_i) {
            S += xp[_i];
        }
        if (S == 0) return 0;

        D = S;
        uint256 Ann = a * N_COINS;
        for (uint256 _i; _i < 256; ++_i) {
            uint256 D_P = D;
            for (uint256 _j; _j < xp.length; ++_j) {
                D_P = (D_P * D) / (xp[_j] * N_COINS);
            }
            Dprev = D;
            D =
                (((Ann * S) / A_PRECISION + D_P * N_COINS) * D) /
                (((Ann - A_PRECISION) * D) / A_PRECISION + (N_COINS + 1) * D_P);
            if (D > Dprev && D - Dprev <= 1) return D;
            else if (Dprev - D <= 1) return D;
        }
        require(false, "Price: Convergence false");
        return 0;
    }

    function getYD(
        uint256 a,
        uint256 i_,
        uint256[2] memory xp,
        uint256 D
    ) internal pure returns (uint256 y) {
        // Solution is taken from pool contract: 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49
        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 c = D;
        uint256 Ann = a * N_COINS;

        for (uint256 _i; _i < N_COINS; ++_i) {
            if (_i != i_) _x = xp[_i];
            else continue;
            S_ += _x;
            c = (c * D) / (_x * N_COINS);
        }

        c = (c * D * A_PRECISION) / (Ann * N_COINS);
        uint256 b = S_ + (D * A_PRECISION) / Ann; // - D
        y = D;

        for (uint256 _i; _i < 255; ++_i) {
            y_prev = y;
            y = (y * y + c) / (2 * y + b - D);
            if (y > y_prev && y - y_prev <= 1) return y;
            else if (y_prev - y <= 1) return y;
        }
        require(false, "Price: Convergence false");
    }

    /**
     * @dev Return the `xp` array for two tokens. Adjusts `balances[0]` by `padding`
     * and `balances[1]` by `rate / PRECISION`.
     * 
     * This is provided as a gas optimization when `rates[0] * PRECISION` has been
     * pre-computed.
     */
    function getXP(
        uint256[2] memory balances,
        uint256 padding,
        uint256 rate
    ) internal pure returns (uint256[2] memory xp) {
        xp[0] = balances[0].mul(padding);
        xp[1] = balances[1].mul(rate).div(PRECISION);
    }

    /**
     * @dev Return the `xp` array for two tokens. Adjusts `balances[0]` by `rates[0]`
     * and `balances[1]` by `rates[1] / PRECISION`.
     */
    function getXP(
        uint256[2] memory balances,
        uint256[2] memory rates
    ) internal pure returns (uint256[2] memory xp) {
        xp[0] = balances[0].mul(rates[0]).div(PRECISION);
        xp[1] = balances[1].mul(rates[1]).div(PRECISION);
    }
}
