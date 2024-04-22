/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, AppStorage, Storage} from "contracts/libraries/LibAppStorage.sol";
import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibEthUsdOracle} from "./LibEthUsdOracle.sol";
import {LibWstethUsdOracle} from "./LibWstethUsdOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {C} from "contracts/C.sol";

/**
 * @title Eth Usd Oracle Library
 * @notice Contains functionalty to fetch the manipulation resistant USD price of different tokens.
 * @dev currently supports:
 * - ETH/USD price
 **/
library LibUsdOracle {
    using SafeMath for uint256;

    function getUsdPrice(address token) internal view returns (uint256) {
        return getUsdPrice(token, 0);
    }

    /**
     * @dev Returns the price of a given token in in USD with the option of using a lookback. (Usd:token Price)
     * `lookback` should be 0 if the instantaneous price is desired. Otherwise, it should be the
     * TWAP lookback in seconds.
     * If using a non-zero lookback, it is recommended to use a substantially large `lookback`
     * (> 900 seconds) to protect against manipulation.
     */
    function getUsdPrice(address token, uint256 lookback) internal view returns (uint256) {
        if (token == C.WETH) {
            uint256 ethUsdPrice = LibEthUsdOracle.getEthUsdPrice(lookback);
            if (ethUsdPrice == 0) return 0;
            return uint256(1e24).div(ethUsdPrice);
        }
        if (token == C.WSTETH) {
            uint256 wstethUsdPrice = LibWstethUsdOracle.getWstethUsdPrice(lookback);
            if (wstethUsdPrice == 0) return 0;
            return uint256(1e24).div(wstethUsdPrice);
        }
        revert("Oracle: Token not supported.");
    }

    function getTokenPrice(address token) internal view returns (uint256) {
        return getTokenPrice(token, 0);
    }

    /**
     * @notice returns the price of a given token in USD (token:Usd Price)
     * @dev if ETH returns 1000 USD, this function returns 1000
     * (ignoring decimal precision)
     */
    function getTokenPrice(address token, uint256 lookback) internal view returns (uint256) {

        // oracles that are implmented within beanstalk should be placed here.
        if (token == C.WETH) {
            uint256 ethUsdPrice = LibEthUsdOracle.getEthUsdPrice(lookback);
            if (ethUsdPrice == 0) return 0;
            return ethUsdPrice;
        }
        if (token == C.WSTETH) {
            uint256 wstethUsdPrice = LibWstethUsdOracle.getWstethUsdPrice(0);
            if (wstethUsdPrice == 0) return 0;
            return wstethUsdPrice;
        }

        // tokens that use the default chainlink oracle implmentation,
        // or a custom oracle implmentation are called here.
        return getTokenPriceFromExternal(token, lookback);
    }

    /**
     * @notice gets the token price from an external oracle.
     * @dev if address is 0, use the current contract.
     * If encodeType is 0x01, use the default chainlink implmentation.
     * Returns 0 rather than reverting if the call fails.
     */
    function getTokenPriceFromExternal(
        address token,
        uint256 lookback
    ) internal view returns (uint256 tokenPrice) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.Implmentation memory oracleImpl = s.ss[token].oracleImplmentation;

        // If the encode type is type 1, use the default chainlink implmentation instead.
        // `target` refers to the address of the price aggergator implmenation
        if(oracleImpl.encodeType == bytes1(0x01)) {
            return LibChainlinkOracle.getTokenPrice(oracleImpl.target, LibChainlinkOracle.FOUR_HOUR_TIMEOUT, lookback);
        }

        // If the oracle implmentation address is not set, use the current contract.
        address target = oracleImpl.target;
        if (target == address(0)) target = address(this);

        (bool success, bytes memory data) = target.staticcall(
            abi.encodeWithSelector(oracleImpl.selector, lookback)
        );

        if (!success) return 0;
        assembly {
            tokenPrice := mload(add(data, add(0x20, 0)))
        }
    }
}
