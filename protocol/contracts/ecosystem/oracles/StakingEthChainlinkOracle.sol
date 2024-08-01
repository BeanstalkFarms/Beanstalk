/**
 * SPDX-License-Identifier: MIT
 **/
import {LibChainlinkOracle} from "contracts/libraries/Oracle/LibChainlinkOracle.sol";
pragma solidity ^0.8.20;

/**
 * @title StakingEthChainlinkOracle
 * @author Brean
 * @notice An oracle implementation that returns the price of staking ETH derivatives in USD.
 * @dev This is done by multiplying the price of xETH/ETH by the price of ETH/USD.
 */
contract StakingEthChainlinkOracle {
    address immutable ethChainlinkOracle;
    uint256 immutable ethTimeout;
    address immutable xEthChainlinkOracle;
    uint256 immutable xEthTimeout;
    address immutable token;

    uint256 internal constant PRECISION = 1e6;
    uint256 internal constant ETH_DECIMALS = 18;

    /**
     * @dev assumes the chainlinkOracle returns the xETH/ETH price.
     */
    constructor(
        address _ethChainlinkOracle,
        uint256 _ethTimeout,
        address _xEthChainlinkOracle,
        uint256 _xEthTimeout,
        address _token
    ) {
        ethChainlinkOracle = _ethChainlinkOracle;
        ethTimeout = _ethTimeout;
        xEthChainlinkOracle = _xEthChainlinkOracle;
        xEthTimeout = _xEthTimeout;
        token = _token;
    }

    function getToken() external view returns (address) {
        return token;
    }

    function getEthChainlinkOracle() external view returns (address, uint256) {
        return (ethChainlinkOracle, ethTimeout);
    }

    function getxEthChainlinkOracle() external view returns (address, uint256) {
        return (xEthChainlinkOracle, xEthTimeout);
    }

    /**
     * @notice returns the price of the token.
     * if decimals are greater than 0, return the USD/TOKEN price.
     * else, return the TOKEN/USD price.
     * TOKEN/USD has 6 decimal precision, whereas USD/TOKEN has the token's decimal precision.
     * @dev if lookback is set to 0, use the instanteous price, else use the TWAP.
     */
    function getPrice(uint256 decimals, uint256 lookback) external view returns (uint256) {
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
