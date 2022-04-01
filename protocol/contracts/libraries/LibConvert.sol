/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "./LibMarket.sol";
import "./LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Convert
**/
library LibConvert {

    using SafeMath for uint256;

    function sellToPegAndAddLiquidity(uint256 beans, uint256 minLP)
        internal
        returns (uint256 lp, uint256 beansConverted)
    {
        (uint256 ethReserve, uint256 beanReserve) = reserves();
        uint256 maxSellBeans = beansToPeg(ethReserve, beanReserve);
        require(maxSellBeans > 0, "Convert: P must be > 1.");
        uint256 sellBeans = calculateSwapInAmount(beanReserve, beans);
        if (sellBeans > maxSellBeans) sellBeans = maxSellBeans;

        (uint256 beansSold, uint256 wethBought) = LibMarket._sell(sellBeans, 1, address(this));
        (beansConverted,, lp) = LibMarket._addLiquidityWETH(wethBought,beans.sub(beansSold),1,1);
        require(lp >= minLP, "Convert: Not enough LP.");
        beansConverted = beansConverted.add(beansSold);
    }

    function removeLPAndBuyToPeg(uint256 lp, uint256 minBeans) 
        internal 
        returns (uint256 beans, uint256 lpConverted) 
    {
        lpConverted = lpToPeg();
        require(lpConverted > 0, "Convert: P must be < 1.");
        if (lpConverted > lp) lpConverted = lp;
        
        (uint256 beansRemoved, uint256 ethRemoved) = removeLiquidityToBeanstalk(lpConverted);
        (, uint256 boughtBeans) = LibMarket._buyWithWETH(1, ethRemoved, address(this));
        beans = beansRemoved.add(boughtBeans);
        require(beans >= minBeans, "Convert: Not enough Beans.");
    }

    function removeLiquidityToBeanstalk(uint256 liquidity)
        private
        returns (uint256 beanAmount, uint256 ethAmount)
    {
        LibMarket.DiamondStorage storage ds = LibMarket.diamondStorage();
        (beanAmount, ethAmount) = IUniswapV2Router02(ds.router).removeLiquidity(
            ds.bean,
            ds.weth,
            liquidity,
            1,
            1,
            address(this),
            block.timestamp
        );
    }

    function beansToPeg(uint ethBeanPool, uint beansBeanPool) internal view returns (uint256 beans) {
        (uint256 ethUSDCPool, uint256 usdcUSDCPool) = pegReserves();

        uint256 newBeans = sqrt(ethBeanPool.mul(beansBeanPool).mul(usdcUSDCPool).div(ethUSDCPool));
        if (newBeans <= beansBeanPool) return 0;
           beans = newBeans - beansBeanPool;
        beans = beans.mul(10000).div(9985);
    }

    /// @notice lpToPeg solves for the maximum amount ofDeposited  LP that can be converted into Deposited Beans
    /// @return lp - the quantity of LP that can be removed such that the eth recieved 
    /// from removing the LP is the exact amount to buy the Bean price back to its peg.
    function lpToPeg() internal view returns (uint256 lp) {
        /* 
        * lpToPeg solves for the quantity of LP that can be removed such that the eth recieved from removing the LP
        * is the exact amount to buy the Bean price back to its peg.
        * If the Bean price is the Bean:Eth Uniswap V2 Pair is > $1, it will return 0 
        * lpToPeg solves the follow system of equations for lp:
        *   lp = eth * totalLP / e
        *   f * eth = sqrt((e - eth) * (b - beans) * y/x) - (e - eth)
        * such that
        *   e / b = (e - eth) / (b - beans)
        * given
        *   e, b - the Ether, Bean reserves in the Eth:Bean Uniswap V2 Pair
        *   y, x - the Ether, USDC reserves in the Eth:USDC Uniswap V2 Pair
        *   f - is the inverse of the 1 sided fee on Uniswap (1 / .9985)
        *   totaLP is the total supply of LP tokens
        * where
        *   eth, beans are the assets returned from removing lp liquidity token from the Eth:Bean Uniswap V2 Pair
        *
        * The solution can be reduced to:
        *   lp = eth * totalLP / e
        *   eth = e (c - 1) / (c + f - 1)
        * such that
        *   c = sqrt((y * b) / (x * e))
        */

        (uint e, uint b) = reserves();
        (uint y, uint x) = pegReserves();
        uint c = sqrt(y*b*1e18/(x*e)).mul(1e9);
        if (c <= 1e18) return 0;
        uint num = e*(c.sub(1e18));
        uint denom = c.sub(1502253380070105); // 0.1502253380070105 ~= f - 1 = 1 / .9985 - 1
        uint eth = num.div(denom);
        return eth.mul(totalLP()).div(e);
    }

    /**
     * Shed
    **/

    function calculateSwapInAmount(uint256 reserveIn, uint256 amountIn)
        private
        pure
        returns (uint256)
    {
        return sqrt(
            reserveIn.mul(amountIn.mul(3988000) + reserveIn.mul(3988009))
        ).sub(reserveIn.mul(1997)) / 1994;
    }

    function totalLP() private view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return IUniswapV2Pair(s.c.pair).totalSupply();
    }

    // (ethereum, beans)
    function reserves() private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();
        return s.index == 0 ? (reserve1, reserve0) : (reserve0, reserve1);
    }

    // (ethereum, usdc)
    function pegReserves() private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pegPair).getReserves();
        return (reserve1, reserve0);
    }

    function sqrt(uint y) private pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
