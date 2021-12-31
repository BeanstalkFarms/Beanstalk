/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../interfaces/IBean.sol";
import "./LibUniswap.sol";
import "../interfaces/IWETH.sol";
import "./LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Convert
**/
library LibConvert {

    using SafeMath for uint256;

    struct WithdrawState {
	    uint256 ethReserve;
	    uint256 beanReserve;
	    uint256 sellBeans;
    }

    function sellToPegAndAddLiquidity(uint256 beans, uint256 minLP, Storage.Settings calldata set)
        internal
        returns (uint256 lp, uint256 beansConverted)
    {
	WithdrawState memory w;
	AppStorage storage s = LibAppStorage.diamondStorage();
        (w.ethReserve, w.beanReserve) = reserves();
        uint256 maxSellBeans = beansToPeg(w.ethReserve, w.beanReserve);
        require(maxSellBeans > 0, "Convert: P must be > 1.");
        w.sellBeans = calculateSwapInAmount(w.beanReserve, beans);
        if (w.sellBeans > maxSellBeans) w.sellBeans = maxSellBeans;

	address[] memory path = new address[](2);
	path[0] = s.c.bean;
	path[1] = s.c.weth;
	uint256[] memory amounts = LibUniswap.swapExactTokensForTokens(w.sellBeans, 1, path, address(this), block.timestamp.add(1), set, true);
        (beansConverted,, lp) = LibUniswap.addLiquidity(s.c.bean, s.c.weth, beans.sub(amounts[0]), amounts[1], 1, 1, address(this), block.timestamp.add(1), true);
        require(lp >= minLP, "Convert: Not enough LP.");
        beansConverted = beansConverted + amounts[0];
    }

    function removeLPAndBuyToPeg(uint256 lp, uint256 minBeans, Storage.Settings calldata set) 
        internal 
        returns (uint256 beans, uint256 lpConverted) 
    {
	AppStorage storage s = LibAppStorage.diamondStorage();
        lpConverted = lpToPeg();
        require(lpConverted > 0, "Convert: P must be < 1.");
        if (lpConverted > lp) lpConverted = lp;
        
        (uint256 beansRemoved, uint256 ethRemoved) = removeLiquidityToBeanstalk(lpConverted);
	address[] memory path = new address[](2);
	path[0] = s.c.weth;
	path[1] = s.c.bean;
	uint256[] memory amounts = LibUniswap.swapExactTokensForTokens(ethRemoved, 1, path, address(this), block.timestamp.add(1), set, true);
        beans = beansRemoved.add(amounts[1]);
        require(beans >= minBeans, "Convert: Not enough Beans.");
    }

    function removeLiquidityToBeanstalk(uint256 liqudity)
        private
        returns (uint256 beanAmount, uint256 ethAmount)
    {
	AppStorage storage s = LibAppStorage.diamondStorage();
        (beanAmount, ethAmount) = LibUniswap.removeLiquidity(
            s.c.bean,
            s.c.weth,
            liqudity,
            1,
            1,
            address(this),
            block.timestamp.add(1),
	    true
        );
    }

    function beansToPeg(uint ethBeanPool, uint beansBeanPool) internal view returns (uint256 beans) {
        (uint256 ethUSDCPool, uint256 usdcUSDCPool) = pegReserves();

        uint256 newBeans = sqrt(ethBeanPool.mul(beansBeanPool).mul(usdcUSDCPool).div(ethUSDCPool));
        if (newBeans <= beansBeanPool) return 0;
           beans = newBeans - beansBeanPool;
        beans = beans.mul(10000).div(9985);
    }

    function lpToPeg() internal view returns (uint256 lp) {
        (uint e, uint b) = reserves();
        (uint y, uint x) = pegReserves();
        uint c = sqrt(y*b*1e18/(x*e)).mul(1e9);
        if (c <= 1e18) return 0;
        uint num = e*(c.sub(1e18));
        uint denom = c.sub(1502253380070105);
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
        return (s.index == 0 ? reserve1 : reserve0, s.index == 0 ? reserve0 : reserve1);
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
