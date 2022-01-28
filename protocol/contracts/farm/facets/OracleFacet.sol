/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";
import "../../libraries/Decimal.sol";
import "../../libraries/UniswapV2OracleLibrary.sol";

/**
 * @author Publius
 * @title Oracle tracks the TWAP price of the USDC/ETH and BEAN/ETH Uniswap pairs.
**/
contract OracleFacet {

    using Decimal for Decimal.D256;

    AppStorage internal s;

    function capture() public virtual returns (Decimal.D256 memory, Decimal.D256 memory) {
        require(address(this) == msg.sender, "Oracle: Beanstalk only");
        if (s.o.initialized) {
            return updateOracle();
        } else {
            initializeOracle();
            return (Decimal.one(), Decimal.one());
        }
    }

    function initializeOracle() internal {
        uint256 priceCumulative = s.index == 0 ?
            IUniswapV2Pair(s.c.pair).price0CumulativeLast() :
            IUniswapV2Pair(s.c.pair).price1CumulativeLast();
        (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        ) = IUniswapV2Pair(s.c.pair).getReserves();

        if(reserve0 != 0 && reserve1 != 0 && blockTimestampLast != 0) {
            s.o.cumulative = priceCumulative;
            s.o.timestamp = blockTimestampLast;
            s.o.initialized = true;
            (uint256 peg_priceCumulative,, uint32 peg_blockTimestamp) =
            UniswapV2OracleLibrary.currentCumulativePrices(s.c.pegPair);
            s.o.pegCumulative = peg_priceCumulative;
            s.o.pegTimestamp = peg_blockTimestamp;
        }
    }

    function updateOracle() internal returns (Decimal.D256 memory, Decimal.D256 memory) {
        (Decimal.D256 memory bean_price, Decimal.D256 memory usdc_price) = updatePrice();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();
        if (reserve0 == 0 || reserve1 == 0) {
            return (Decimal.one(),Decimal.one());
        }
        return (bean_price, usdc_price);
    }

    function updatePrice() private returns (Decimal.D256 memory, Decimal.D256 memory) {
        (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePrices(s.c.pair);
        (uint256 peg_priceCumulative,, uint32 peg_blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePrices(s.c.pegPair);
        uint256 priceCumulative = s.index == 0 ? price0Cumulative : price1Cumulative;

        uint32 timeElapsed = blockTimestamp - s.o.timestamp; // overflow is desired
        uint32 pegTimeElapsed = peg_blockTimestamp - s.o.pegTimestamp; // overflow is desired

        uint256 price1 = (priceCumulative - s.o.cumulative) / timeElapsed / 1e12;
        uint256 price2 = (peg_priceCumulative - s.o.pegCumulative) / pegTimeElapsed / 1e12;

        Decimal.D256 memory bean_price = Decimal.ratio(price1, 2**112);
        Decimal.D256 memory usdc_price = Decimal.ratio(price2, 2**112);

        s.o.timestamp = blockTimestamp;
        s.o.pegTimestamp = peg_blockTimestamp;

        s.o.cumulative = priceCumulative;
        s.o.pegCumulative = peg_priceCumulative;

        return (bean_price, usdc_price);
    }

    function getTWAPPrices() public view returns (uint256, uint256) {
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

}
