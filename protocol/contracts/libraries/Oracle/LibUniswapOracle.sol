/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "~/C.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @author Publius
 * @title Lib Uniswap Oracle reads Uniswap V3 Oracles
 **/

library LibUniswapOracle {

    // 15 minutes
    uint32 constant PERIOD = 60;
    uint128 constant ONE_WETH = 1e18;

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of WETH denominated in USDC.
     *
     * {OracleLibrary.getQuoteAtTick} returns an arithmetic mean.
     */
    function getEthUsdcPrice() internal view returns (uint256 price) {
        (int24 tick, ) = OracleLibrary.consult(C.UNIV3_ETH_USDC_POOL, PERIOD);
        price = OracleLibrary.getQuoteAtTick(tick, ONE_WETH, C.WETH, C.USDC);
    }

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of WETH denominated in USDC.
     *
     * {OracleLibrary.getQuoteAtTick} returns an arithmetic mean.
     */
    function getEthUsdtPrice() internal view returns (uint256 price) {
        (int24 tick, ) = OracleLibrary.consult(C.UNIV3_ETH_USDT_POOL, PERIOD);
        price = OracleLibrary.getQuoteAtTick(tick, ONE_WETH, C.WETH, C.USDT);
    }
}
