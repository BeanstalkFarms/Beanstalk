/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;

import {LibChainlinkOracle} from "contracts/libraries/Oracle/LibChainlinkOracle.sol";

/**
 * @title LSDChainlinkOracle
 * @author Brean
 * @notice An oracle implementation that returns the price of a ETH LSD in USD.
 * @dev This is done by multiplying the price of xETH/ETH by the price of ETH/USD.
 */
contract LSDChainlinkOracle {
    uint256 internal constant PRECISION = 1e6;
    uint256 internal constant ETH_DECIMALS = 18;

    /**
     * @notice decodes data using the same format that the getPrice function uses.
     * Used to verify the data is encoded correctly.
     */
    function decodeData(
        bytes memory data
    )
        external
        pure
        returns (
            address ethChainlinkOracle,
            uint256 ethTimeout,
            address xEthChainlinkOracle,
            uint256 xEthTimeout
        )
    {
        (ethChainlinkOracle, ethTimeout, xEthChainlinkOracle, xEthTimeout) = abi.decode(
            data,
            (address, uint256, address, uint256)
        );
    }

    /**
     * @notice returns the price of the token.
     * if decimals are greater than 0, return the USD/TOKEN price.
     * else, return the TOKEN/USD price.
     * TOKEN/USD has 6 decimal precision, whereas USD/TOKEN has the token's decimal precision.
     * @dev if lookback is set to 0, use the instanteous price, else use the TWAP.
     */
    function getPrice(
        uint256 decimals,
        uint256 lookback,
        bytes memory data
    ) external view returns (uint256) {
        (
            address ethChainlinkOracle,
            uint256 ethTimeout,
            address xEthChainlinkOracle,
            uint256 xEthTimeout
        ) = abi.decode(data, (address, uint256, address, uint256));

        // get the price of xETH/ETH or ETH/xETH, depending on decimals.
        uint256 xEthEthPrice = LibChainlinkOracle.getTokenPrice(
            xEthChainlinkOracle,
            xEthTimeout,
            decimals,
            lookback
        );

        // get the price of ETH/USD or USD/ETH. (note: ETH has 18 decimals.)
        uint256 ethUsdPrice = LibChainlinkOracle.getTokenPrice(
            ethChainlinkOracle,
            ethTimeout,
            decimals == 0 ? 0 : ETH_DECIMALS,
            lookback
        );

        if (decimals == 0) {
            // xETH/ETH (6 decimals) * ETH/USD (6 decimals) / PRECISION = xETH/USD (6 decimals)
            return (xEthEthPrice * ethUsdPrice) / PRECISION;
        } else {
            // USD/ETH (n decimals) * ETH/xETH (18 decimals) / 10 ** ETH_DECIMALS = USD/xETH (n decimals)
            return (xEthEthPrice * ethUsdPrice) / (10 ** ETH_DECIMALS);
        }
    }
}
