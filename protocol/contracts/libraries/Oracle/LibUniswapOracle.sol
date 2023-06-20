/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @title Uniswap Oracle Library
 * @notice Contains functionalty to read prices from Uniswap V3 pools.
 * @dev currently supports:
 * - ETH:USDC price from the ETH:USDC 0.3% pool
 * - ETH:USDT price from the ETH:USDT 0.3% pool
 **/
library LibUniswapOracle {

    // TODO: Finalize. Currently set to 15 minutes
    uint32 constant PERIOD = 900;
    uint128 constant ONE_WETH = 1e18;

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of WETH denominated in USDC.
     */
    function getEthUsdcPrice() internal view returns (uint256 price) {
        (int24 tick, ) = OracleLibrary.consult(C.UNIV3_ETH_USDC_POOL, PERIOD);
        price = OracleLibrary.getQuoteAtTick(tick, ONE_WETH, C.WETH, C.USDC);
    }

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of WETH denominated in USDT.
     */
    function getEthUsdtPrice() internal view returns (uint256 price) {
        (int24 tick, ) = OracleLibrary.consult(C.UNIV3_ETH_USDT_POOL, PERIOD);
        price = OracleLibrary.getQuoteAtTick(tick, ONE_WETH, C.WETH, C.USDT);
    }
}
