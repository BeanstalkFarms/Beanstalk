/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Decimal.sol";
import "../../libraries/UniswapV2OracleLibrary.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Oracle tracks the TWAP price of the USDC/ETH and BEAN/ETH Uniswap pairs.
**/
contract LibUniswapOracle {

    using Decimal for Decimal.D256;
    using SafeMath for uint256;

    function captureUniswap() internal returns (int256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.o.initialized) {
            return updateOracle();
        } else {
            initializeOracle();
            return 0;
        }
    }

    function initializeOracle() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        ) = IUniswapV2Pair(s.c.pair).getReserves();

        if(reserve0 != 0 && reserve1 != 0 && blockTimestampLast != 0) {
            s.o.initialized = true;
            (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) =
                UniswapV2OracleLibrary.currentCumulativePrices(s.c.pair);
            s.o.cumulative = s.index == 0 ? price0Cumulative : price1Cumulative;
            s.o.timestamp = blockTimestamp;
            (uint256 peg_priceCumulative,, uint32 peg_blockTimestamp) =
            UniswapV2OracleLibrary.currentCumulativePrices(s.c.pegPair);
            s.o.pegCumulative = peg_priceCumulative;
            s.o.pegTimestamp = peg_blockTimestamp;
        }
    }

    function updateOracle() internal returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256[2] memory prices = updateTWAP();

        (uint256 eth_reserve, uint256 bean_reserve) = lockedReserves();
        int256 currentBeans = int256(sqrt(
            bean_reserve.mul(eth_reserve).mul(1e6).div(prices[0])
        ));
        int256 targetBeans = int256(sqrt(
            bean_reserve.mul(eth_reserve).mul(1e6).div(prices[1])
        ));

        return targetBeans-currentBeans;
    }

    function updateTWAP() internal returns (uint256[2] memory balances) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePrices(s.c.pair);
        (uint256 peg_priceCumulative,, uint32 peg_blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePrices(s.c.pegPair);
        uint256 priceCumulative = s.index == 0 ? price0Cumulative : price1Cumulative;

        uint32 timeElapsed = blockTimestamp - s.o.timestamp; // overflow is desired
        uint32 pegTimeElapsed = peg_blockTimestamp - s.o.pegTimestamp; // overflow is desired

        uint256 price1 = (priceCumulative - s.o.cumulative) / timeElapsed;
        uint256 price2 = (peg_priceCumulative - s.o.pegCumulative) / pegTimeElapsed;

        Decimal.D256 memory bean_price = Decimal.ratio(price1, 2**112);
        Decimal.D256 memory usdc_price = Decimal.ratio(price2, 2**112);

        s.o.timestamp = blockTimestamp;
        s.o.pegTimestamp = peg_blockTimestamp;

        s.o.cumulative = priceCumulative;
        s.o.pegCumulative = peg_priceCumulative;

        balances[0] = bean_price.mul(1e6).asUint256();
        balances[1] = usdc_price.mul(1e6).asUint256();
    }

    function getTWAPPrices() internal view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.o.timestamp == 0) return (1e18, 1e18);
        (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePrices(s.c.pair);
        (uint256 peg_priceCumulative,, uint32 peg_blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePrices(s.c.pegPair);
        uint256 priceCumulative = s.index == 0 ? price0Cumulative : price1Cumulative;

        uint32 timeElapsed = blockTimestamp - s.o.timestamp; // overflow is desired
        uint32 pegTimeElapsed = peg_blockTimestamp - s.o.pegTimestamp; // overflow is desired

        uint256 beanPrice;
        uint256 usdcPrice;
        if (timeElapsed > 0) {
            uint256 price1 = (priceCumulative - s.o.cumulative) / timeElapsed / 1e12;
            beanPrice = Decimal.ratio(price1, 2**112).mul(1e18).asUint256();
        } else {
            (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();
            beanPrice = (s.index == 0 ? 1e6 * reserve1 / reserve0 : 1e6 * reserve0 / reserve1);
        }
        if (pegTimeElapsed > 0) {
            uint256 price2 = (peg_priceCumulative - s.o.pegCumulative) / pegTimeElapsed / 1e12;
            usdcPrice = Decimal.ratio(price2, 2**112).mul(1e18).asUint256();
        } else {
            (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(s.c.pegPair).getReserves();
            usdcPrice = 1e6 * reserve1 / reserve0;
        }
        return (beanPrice, usdcPrice);
    }

    function reserves() internal view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();
        return (s.index == 0 ? reserve1 : reserve0,s.index == 0 ? reserve0 : reserve1);
    }

    function lockedReserves() internal view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint ethReserve, uint beanReserve) = reserves();
        uint lp = IUniswapV2Pair(s.c.pair).totalSupply();
        if (lp == 0) return (0,0);
        uint lockedLP = s.lp.deposited.add(s.lp.withdrawn);
        ethReserve = ethReserve.mul(lockedLP).div(lp);
        beanReserve = beanReserve.mul(lockedLP).div(lp);
        return (ethReserve, beanReserve);
    }

    function sqrt(uint y) internal pure returns (uint z) {
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
