/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../Utils/LibToolShed.sol";
import "../LibMarket.sol";
import "../LibAppStorage.sol";
import "./LibConvertUserData.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Lib Convert
**/
library LibUniswapConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    function beansToPeg() internal view returns (uint256 beans) {
        (uint256 ethReserve, uint256 beanReserve) = reserves();
        uint256 sellBeans = _beansToPeg(ethReserve, beanReserve);
        uint256 ethBought = getToAmount(sellBeans, beanReserve, ethReserve);
        uint256 newBeanReserve = beanReserve.add(sellBeans);
        ethReserve = ethReserve.mul(beanReserve).div(newBeanReserve);
        beans = sellBeans.add(ethBought.mul(newBeanReserve).div(ethReserve));
    }

    function _beansToPeg(uint ethBeanPool, uint beansBeanPool) private view returns (uint256 beans) {
        (uint256 ethUSDCPool, uint256 usdcUSDCPool) = pegReserves();

        uint256 newBeans = LibToolShed.sqrt(ethBeanPool.mul(beansBeanPool).mul(usdcUSDCPool).div(ethUSDCPool));
        if (newBeans <= beansBeanPool) return 0;
           beans = newBeans - beansBeanPool;
        beans = beans.mul(10000).div(9985);
    }

    function lpToPeg() internal view returns (uint256 lp) {
        (uint e, uint b) = reserves();
        (uint y, uint x) = pegReserves();
        uint c = LibToolShed.sqrt(y*b*1e18/(x*e)).mul(1e9);
        if (c <= 1e18) return 0;
        uint num = e*(c.sub(1e18));
        uint denom = c.sub(1502253380070105);
        uint eth = num.div(denom);
        return eth.mul(totalLP()).div(e);
    }

    /**
        * Convert Function Selector Functions
        **/

        /**
        * Sell To Peg Convert Functions
        **/

        /// @notice Takes in parameters to convert beans into LP by selling some beans to the Peg for ETH to convert them into LP using Uniswap
        /// @param userData Contains convert input parameters for a Uniswap convert Beans to LP
    function convertBeansToLP(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        (uint256 beans, uint256 minLP) = userData.basicConvert();
        (outAmount, inAmount) = _uniswapSellToPegAndAddLiquidity(beans, minLP);
        outToken = C.uniswapV2PairAddress();
        inToken = C.beanAddress();
        bdv = inAmount;
    }

    /// @notice Takes in encoded bytes for adding Uniswap LP in beans, extracts the input data, and then calls the
    ///         _uniswapSellToPegAndAddLiquidity function
    /// @param userData Contains convert input parameters for a Uniswap AddLPInBeans convert
    function convertLPToBeans(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        (uint256 lp, uint256 minBeans) = userData.basicConvert();
        (outAmount, inAmount) = _uniswapRemoveLPAndBuyToPeg(lp, minBeans);
        outToken = C.beanAddress();
        inToken = C.uniswapV2PairAddress();
        bdv = outAmount;
    }

    /**
     * Buy To Peg Convert Functions
    **/

    /// @notice Takes in parameters to convert LP into beans by selling some LP, using the ETH obtained to convert them into beans using Uniswap
    /// @param lp - the amount of Uniswap lp to be removed
    /// @param minBeans - min amount of beans to receive
    function _uniswapRemoveLPAndBuyToPeg(uint256 lp, uint256 minBeans) private returns (uint256 beans, uint256 lpConverted) {
        lpConverted = lpToPeg();
        require(lpConverted > 0, "Convert: P must be < 1.");
        if (lpConverted > lp) lpConverted = lp;
        (uint256 beansRemoved, uint256 ethRemoved) = removeLiquidityToBeanstalk(lpConverted);
        (, uint256 boughtBeans) = LibMarket._buyWithWETH(1, ethRemoved, address(this));
        beans = beansRemoved.add(boughtBeans);
        require(beans >= minBeans, "Convert: Not enough Beans.");
    }

    // Cross-Pool Buy To Peg/Sell To Peg Functions

    /// @notice Takes in encoded bytes for adding Curve LP in Uniswap LP, extracts the input data, and then calls the
    ///         _uniswapRemoveLPAndBuyToPeg and then _curveSellToPegAndAddLiquidity
    /// @param beans the amount of Beans to convert
    /// @param minLP the minimum amount of LP to receive from converting
    function _uniswapSellToPegAndAddLiquidity(uint256 beans, uint256 minLP) private returns (uint256 lp, uint256 beansConverted) {
        (uint256 ethReserve, uint256 beanReserve) = reserves();
        uint256 maxSellBeans = _beansToPeg(ethReserve, beanReserve);
        require(maxSellBeans > 0, "Convert: P must be > 1.");
        uint256 sellBeans = calculateSwapInAmount(beanReserve, beans);
        if (sellBeans > maxSellBeans) sellBeans = maxSellBeans;

        (uint256 beansSold, uint256 wethBought) = LibMarket._sell(sellBeans, 1, address(this));
        (beansConverted,, lp) = LibMarket._addLiquidityWETH(wethBought,beans.sub(beansSold),1,1);
        require(lp >= minLP, "Convert: Not enough LP.");
        beansConverted = beansConverted + beansSold;
    }

    /**
     * Shed
    **/

    function removeLiquidityToBeanstalk(uint256 liqudity)
        private
        returns (uint256 beanAmount, uint256 ethAmount)
    {
        LibMarket.DiamondStorage storage ds = LibMarket.diamondStorage();
        (beanAmount, ethAmount) = IUniswapV2Router02(ds.router).removeLiquidity(
            ds.bean,
            ds.weth,
            liqudity,
            1,
            1,
            address(this),
            block.timestamp.add(1)
        );
    }

    function calculateSwapInAmount(uint256 reserveIn, uint256 amountIn)
        private
        pure
        returns (uint256)
    {
        return LibToolShed.sqrt(
            reserveIn.mul(amountIn.mul(3988000) + reserveIn.mul(3988009))
        ).sub(reserveIn.mul(1997)) / 1994;
    }

    function totalLP() private view returns (uint256) {
        return C.uniswapV2Pair().totalSupply();
    }

    // (ethereum, beans)
    function reserves() private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = C.uniswapV2Pair().getReserves();
        return (s.index == 0 ? reserve1 : reserve0, s.index == 0 ? reserve0 : reserve1);
    }

    // (ethereum, usdc)
    function pegReserves() private view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pegPair).getReserves();
        return (reserve1, reserve0);
    }

    function getToAmount(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn.mul(997);
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator.div(denominator);
    }

}
