/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./LibAppStorage.sol";
import "./UniswapV2OracleLibrary.sol";

/**
 * @author Publius
 * @title Lib Bean Eth Uniswap V2 Silo
**/
library LibBeanEthUniswap {
    
    using SafeMath for uint256;

    uint256 private constant TWO_TO_THE_112 = 2**112;

    function bdv(uint256 amount) internal view returns (uint256 beans) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint112 reserve0, uint112 reserve1, uint32 lastTimestamp) = IUniswapV2Pair(s.c.pair).getReserves();

        uint256 beanReserve;

        // Check the last timestamp in the Uniswap Pair to see if anyone has interacted with the pair this block.
        // If so, use current Season TWAP to calculate Bean Reserves for flash loan protection
        // If not, we can use the current reserves with the assurance that there is no active flash loan
        if (lastTimestamp == uint32(block.timestamp % 2 ** 32)) 
            beanReserve = twapBeanReserve(reserve0, reserve1, lastTimestamp);
        else 
            beanReserve = s.index == 0 ? reserve0 : reserve1;
        beans = amount.mul(beanReserve).mul(2).div(IUniswapV2Pair(s.c.pair).totalSupply());
    }

    function twapBeanReserve(uint112 reserve0, uint112 reserve1, uint32 lastTimestamp) internal view returns (uint256 beans) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) =
        UniswapV2OracleLibrary.currentCumulativePricesWithReserves(
            s.c.pair, 
            reserve0,
            reserve1,
            lastTimestamp
        );
        uint256 priceCumulative = s.index == 0 ? price0Cumulative : price1Cumulative;
        uint32 deltaTimestamp = uint32(blockTimestamp - s.o.timestamp);
        require(deltaTimestamp > 0, "Silo: Oracle same Season");
        uint256 price = (priceCumulative - s.o.cumulative) / deltaTimestamp;
        price = price.div(TWO_TO_THE_112);
        beans = sqrt(uint256(reserve0).mul(uint256(reserve1)).div(price));
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
