//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {P} from "./P.sol";
import "contracts/libraries/Curve/LibMetaCurve.sol";
import "contracts/libraries/Curve/LibCurve.sol";

interface IERC20D {
    function decimals() external view returns (uint8);
}

interface IBDV {
    function bdv(address token, uint256 amount) external view returns (uint256);
}

contract CurvePrice {

    using SafeMath for uint256;

    //-------------------------------------------------------------------------------------------------------------------
    // Mainnet
    address private constant POOL = 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49;
    address private constant CRV3_POOL = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    address private constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;
    //-------------------------------------------------------------------------------------------------------------------

    uint256 private constant A_PRECISION = 100; 
    uint256 private constant N_COINS  = 2;
    uint256 private constant RATE_MULTIPLIER = 10 ** 30;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant i = 0;
    uint256 private constant j = 1;
    address[2] private tokens = [0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab, 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490];

    function getCurve() public view returns (P.Pool memory pool) {
        pool.pool = POOL;
        pool.tokens = tokens;
        uint256[2] memory balances = ICurvePool(POOL).get_balances();
        pool.balances = balances;
        uint256[2] memory rates = getRates();
        uint256[2] memory xp = LibCurve.getXP(balances, rates);
        uint256 a = ICurvePool(POOL).A_precise();
        uint256 D = getD(xp, a);

        pool.price = LibCurve.getPrice(xp, rates, a, D);
        rates[0] = rates[0].mul(pool.price).div(1e6);
        pool.liquidity = getCurveUSDValue(balances, rates);
        pool.deltaB = getCurveDeltaB(balances[0], D);
        pool.lpUsd = pool.liquidity * 1e18 / ICurvePool(POOL).totalSupply();
        pool.lpBdv = IBDV(BEANSTALK).bdv(POOL, 1e18);
    }

    function getCurveDeltaB(uint256 balance, uint256 D) private pure returns (int deltaB) {
        uint256 pegBeans = D / 2 / 1e12;
        deltaB = int256(pegBeans) - int256(balance);
    }

    function getCurveUSDValue(uint256[2] memory balances, uint256[2] memory rates) private pure returns (uint) {
        uint256[2] memory value = LibCurve.getXP(balances, rates);
        return (value[0] + value[1]) / 1e12;
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
    }

    function getRates() private view returns (uint256[2] memory rates) {
        uint8 decimals = IERC20D(tokens[0]).decimals();
        return [10**(36-decimals), I3Curve(CRV3_POOL).get_virtual_price()];
    }
}
