//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

interface I3Curve {
    function get_virtual_price() external view returns (uint256);
}

interface IMeta3Curve {
    function A_precise() external view returns (uint256);
    function get_balances() external view returns (uint256[2] memory);
    function totalSupply() external view returns (uint256);
}

library LibMetaCurve {
    using SafeMath for uint256;

    uint256 private constant A_PRECISION = 100;
    address private constant POOL = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
    address private constant CRV3_POOL = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    uint256 private constant N_COINS  = 2;
    uint256 private constant RATE_MULTIPLIER = 10 ** 30; // Bean has 6 Decimals
    uint256 private constant PRECISION = 1e18;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    function bdv(uint256 amount) internal view returns (uint256) {
        uint256[2] memory balances = IMeta3Curve(POOL).get_balances();
        uint256 totalSupply = IMeta3Curve(POOL).totalSupply();
        uint256[2] memory rates = getRates();
        uint256 price = getPrice(balances,rates);
        uint256 beanValue = balances[0].mul(amount).div(totalSupply);
        uint256 curveValue = balances[1].mul(price).mul(amount).div(totalSupply).div(1e18);
        return beanValue.add(curveValue);
    }
    
    function getPrice(uint256[2] memory balances, uint256[2] memory rates) private view returns (uint) {
        uint256[2] memory xp = getXP(balances, rates);

        uint256 x = xp[i] + (rates[i] / PRECISION);
        uint256 y = getY(x, xp);
        uint256 dy = xp[j] - y - 1;
        return dy / 1e6;
    }

    function getY(uint256 x, uint256[2] memory xp) private view returns (uint256) {

        uint256 a = IMeta3Curve(POOL).A_precise();
        uint256 D = getD(xp, a);
        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 c = D;
        uint256 Ann = a * N_COINS;

        for (uint256 _i = 0; _i < N_COINS; _i++) {
            if (_i == i) _x = x;
            else if (_i != j) _x = xp[_i];
            else continue;
            S_ += _x;
            c = c * D / (_x * N_COINS);
        }

        c = c * D * A_PRECISION / (Ann * N_COINS);
        uint256 b = S_ + D * A_PRECISION / Ann; // - D
        uint256 y = D;

        for (uint256 _i = 0; _i < 255; _i++) {
            y_prev = y;
            y = (y*y + c) / (2 * y + b - D);
            // Equality with the precision of 1
            if (y > y_prev && y - y_prev <= 1) return y;
            else if (y_prev - y <= 1) return y;
        }
        require(false, "Price: Convergence false");
    }



    function getD(uint256[2] memory xp, uint256 a) private pure returns (uint D) {
        
        /*  
        * D invariant calculation in non-overflowing integer operations
        * iteratively
        *
        * A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))
        *
        * Converging solution:
        * D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
        */
        uint256 S;
        uint256 Dprev;
        for (uint _i = 0; _i < xp.length; _i++) {
            S += xp[_i];
        }
        if (S == 0) return 0;

        D = S;
        uint256 Ann = a * N_COINS;
        for (uint _i = 0; _i < 256; _i++) {
            uint256 D_P = D;
            for (uint _j = 0; _j < xp.length; _j++) {
                D_P = D_P * D / (xp[_j] * N_COINS);  // If division by 0, this will be borked: only withdrawal will work. And that is good
            }
            Dprev = D;
            D = (Ann * S / A_PRECISION + D_P * N_COINS) * D / ((Ann - A_PRECISION) * D / A_PRECISION + (N_COINS + 1) * D_P);
            // Equality with the precision of 1
            if (D > Dprev && D - Dprev <= 1) return D;
            else if (Dprev - D <= 1) return D;
        }
        // convergence typically occurs in 4 rounds or less, this should be unreachable!
        // if it does happen the pool is borked and LPs can withdraw via `remove_liquidity`
        require(false, "Price: Convergence false");
        return 0;
    }

    function getXP(uint256[2] memory balances, uint256[2] memory rates) private pure returns (uint256[2] memory xp) {
        xp[0] = balances[0].mul(rates[0]).div(PRECISION);
        xp[1] = balances[1].mul(rates[1]).div(PRECISION);
    }

    function getRates() private view returns (uint256[2] memory rates) {
        return [RATE_MULTIPLIER, I3Curve(CRV3_POOL).get_virtual_price()];
    }
}
