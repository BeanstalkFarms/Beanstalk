/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "./Utils/LibToolShed.sol";
import "./LibMarket.sol";
import "./LibAppStorage.sol";
import "./LibConvertUserData.sol";
import "./LibMetaCurve.sol";

/**
 * @author Publius
 * @title Lib Convert
**/
library LibConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    /// @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
    ///         a specified pool and returns the in and out convert amounts and token addresses and bdv
    /// @param userData Contains convert input parameters for a specified convert
    function convert(bytes memory userData)
        internal
        returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv)
    {
        LibConvertUserData.ConvertKind kind = userData.convertKind();

        if (kind == LibConvertUserData.ConvertKind.CURVE_ADD_LP_IN_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertCurveAddLPInBeans(userData);
        } else if (kind == LibConvertUserData.ConvertKind.UNISWAP_ADD_LP_IN_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertUniswapAddLPInBeans(userData);
        } else if (kind == LibConvertUserData.ConvertKind.CURVE_ADD_BEANS_IN_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertCurveAddBeansInLP(userData);
        } else if (kind == LibConvertUserData.ConvertKind.UNISWAP_ADD_BEANS_IN_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertUniswapAddBeansInLP(userData);
        } 
        else if (kind == LibConvertUserData.ConvertKind.UNISWAP_BUY_TO_PEG_AND_CURVE_SELL_TO_PEG) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertUniswapBuyToPegAndCurveSellToPeg(userData);
        } else if (kind == LibConvertUserData.ConvertKind.CURVE_BUY_TO_PEG_AND_UNISWAP_SELL_TO_PEG) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertCurveBuyToPegAndUniswapSellToPeg(userData);
        } 

        // else {
        //     _revert(Errors.UNHANDLED_CONVERT_KIND);
        // }
    }

    function sellToPegAndAddLiquidity(bytes memory userData)
        internal
        returns (uint256 lp, uint256 beansConverted)
    {
        LibConvertUserData.ConvertKind kind = userData.convertKind();

        address outToken;
        address inToken;
        uint256 outAmount;
        uint256 inAmount;
        uint256 bdv;

        if (kind == LibConvertUserData.ConvertKind.CURVE_ADD_LP_IN_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertCurveAddLPInBeans(userData);
            return (outAmount, inAmount);
        } else if (kind == LibConvertUserData.ConvertKind.UNISWAP_ADD_LP_IN_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertUniswapAddLPInBeans(userData);
            return (outAmount, inAmount);
        } 
        // else {
        //     _revert(Errors.UNHANDLED_CONVERT_KIND);
        // }
    }

    function removeLPAndBuyToPeg(bytes memory userData)
        internal
        returns (uint256 beans, uint256 lpConverted)
    {
        LibConvertUserData.ConvertKind kind = userData.convertKind();

        address outToken;
        address inToken;
        uint256 outAmount;
        uint256 inAmount;
        uint256 bdv;

        if (kind == LibConvertUserData.ConvertKind.CURVE_ADD_BEANS_IN_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertCurveAddBeansInLP(userData);
            return (outAmount, inAmount);
        } else if (kind == LibConvertUserData.ConvertKind.UNISWAP_ADD_BEANS_IN_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = _convertUniswapAddBeansInLP(userData);
            return (outAmount, inAmount);
        } 
        // else {
        //     _revert(Errors.UNHANDLED_CONVERT_KIND);
        // }
    }

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

    function beansToPeg(uint ethBeanPool, uint beansBeanPool) internal view returns (uint256 beans) {
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

    /// @notice Takes in parameters to convert beans into LP by selling some beans to the Peg for ETH 
    ///         to convert them into LP using Uniswap
    /// @param beans - amount of beans to convert to Uniswap LP
    /// @param minLP - min amount of Uniswap LP to receive
    function _uniswapSellToPegAndAddLiquidity(uint256 beans, uint256 minLP) private returns (uint256 lp, uint256 beansConverted) {
        (uint256 ethReserve, uint256 beanReserve) = reserves();
        uint256 maxSellBeans = beansToPeg(ethReserve, beanReserve);
        require(maxSellBeans > 0, "Convert: P must be > 1.");
        uint256 sellBeans = calculateSwapInAmount(beanReserve, beans);
        if (sellBeans > maxSellBeans) sellBeans = maxSellBeans;

        (uint256 beansSold, uint256 wethBought) = LibMarket._sell(sellBeans, 1, address(this));
        (beansConverted,, lp) = LibMarket._addLiquidityWETH(wethBought,beans.sub(beansSold),1,1);
        require(lp >= minLP, "Convert: Not enough LP.");
        beansConverted = beansConverted + beansSold;
    }

    /// @notice Takes in parameters to convert beans into LP using Curve
    /// @param beans - amount of beans to convert to Curve LP
    /// @param minLP - min amount of Curve LP to receive
    function _curveSellToPegAndAddLiquidity(uint256 beans, uint256 minLP) private returns (uint256 lp, uint256 beansConverted) {
        uint256[] memory amounts;
        amounts[0] = beans;
        lp = LibMetaCurve.addLiquidity(amounts, minLP);
        beansConverted = beans;
    }

    /// @notice Takes in encoded bytes for adding Uniswap LP in beans, extracts the input data, and then calls the
    ///         _uniswapSellToPegAndAddLiquidity function
    /// @param userData Contains convert input parameters for a Uniswap AddLPInBeans convert
    function _convertUniswapAddLPInBeans(bytes memory userData) private returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint256 beans, uint256 minLP) = userData.addLPInBeans();
        (outAmount, inAmount) = _uniswapSellToPegAndAddLiquidity(beans, minLP);
        outToken = s.c.pair;
        inToken = s.c.bean;
        bdv = inAmount;
    }

    /// @notice Takes in encoded bytes for adding Curve LP in beans, extracts the input data, and then calls the
    ///         _curveSellToPegAndAddLiquidity function
    /// @param userData Contains convert input parameters for a Curve AddLPInBeans convert
    function _convertCurveAddLPInBeans(bytes memory userData) private returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        (uint256 beans, uint256 minLP) = userData.addLPInBeans();
        (outAmount, inAmount) = _curveSellToPegAndAddLiquidity(beans, minLP);
        outToken = s.c.pair;
        inToken = s.c.bean;
        bdv = inAmount;
    }

    /**
     * Buy To Peg Convert Functions
    **/

    /// @notice Takes in parameters to convert LP into beans by selling some LP, using the ETH obtained to
    ///         convert them into beans using Uniswap
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

    /// @notice Takes in parameters to remove LP into beans by removing LP in curve through removing beans 
    /// @param lp - the amount of Curve lp to be removed
    /// @param minBeans - min amount of beans to receive    
    function _curveRemoveLPAndBuyToPeg(uint256 lp, uint256 minBeans) private returns (uint256 beans, uint256 lpConverted) {
        beans = LibMetaCurve.removeLiquidityOneCoin(lp, 0, minBeans);
        lpConverted = lp;
    }

    /// @notice Takes in encoded bytes for adding beans in Uniswap LP, extracts the input data, and then calls the
    ///         _uniswapRemoveLPAndBuyToPeg function
    /// @param userData Contains convert input parameters for a Uniswap AddBeansInLP convert
    function _convertUniswapAddBeansInLP(bytes memory userData) private returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        (uint256 lp, uint256 minBeans) = userData.addBeansInLP();
        (outAmount, inAmount) = _uniswapRemoveLPAndBuyToPeg(lp, minBeans);
        outToken = s.c.pair;
        inToken = s.c.bean;
        bdv = outAmount;
        
    }

    /// @notice Takes in encoded bytes for adding beans in Curve LP, extracts the input data, and then calls the
    ///         _uniswapRemoveLPAndBuyToPeg function
    /// @param userData Contains convert input parameters for a Curve AddBeansInLP convert
    function _convertCurveAddBeansInLP(bytes memory userData) private returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint256 lp, uint256 minBeans) = userData.addBeansInLP();
        (outAmount, inAmount) = _curveRemoveLPAndBuyToPeg(lp, minBeans);
        outToken = s.c.pair;
        inToken = s.c.bean;
        bdv = outAmount;
    }

    // Cross-Pool Buy To Peg/Sell To Peg Functions

    /// @notice Takes in encoded bytes for adding Curve LP in Uniswap LP, extracts the input data, and then calls the
    ///         _uniswapRemoveLPAndBuyToPeg and then _curveSellToPegAndAddLiquidity
    /// @param userData Contains convert input parameters for a Curve AddCurveLPInUniswapLP convert
    function _convertUniswapBuyToPegAndCurveSellToPeg(bytes memory userData)
        private
        returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) 
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint256 uniswapLP, uint256 minBeans, uint256 beans, uint256 minCurveLP) = userData.uniswapBuyToPegAndCurveSellToPeg();
        (, uint256 inAmount) = _uniswapRemoveLPAndBuyToPeg(uniswapLP, minBeans);
        (uint256 outAmount, uint256 bdv) = _curveSellToPegAndAddLiquidity(beans, minCurveLP);
        address outToken = s.bean3Curve;
        address inToken = s.c.pair;
    }

    /// @notice Takes in encoded bytes for adding Uniswap LP in Curve LP, extracts the input data, and then calls the
    ///         _curveRemoveLPAndBuyToPeg and then _uniswapSellToPegAndAddLiquidity
    /// @param userData Contains convert input parameters for a Curve AddUniswapLPInCurveLP convert
    function _convertCurveBuyToPegAndUniswapSellToPeg(bytes memory userData)
        private
        returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint256 curveLP, uint256 minBeans, uint256 beans, uint256 minUniswapLP) = userData.curveBuyToPegAndUniswapSellToPeg();
        (, uint256 inAmount) = _curveRemoveLPAndBuyToPeg(curveLP, minBeans);
        (uint256 outAmount, uint256 bdv) = _uniswapSellToPegAndAddLiquidity(beans, minUniswapLP);
        address outToken = s.c.pair;
        address inToken = s.bean3Curve;
    }

    /**
     * Shed
    **/

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

}
