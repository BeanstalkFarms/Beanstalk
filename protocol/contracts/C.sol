// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./interfaces/IBean.sol";
import "./interfaces/IFertilizer.sol";
import "./interfaces/IProxyAdmin.sol";
import "./libraries/Decimal.sol";

/**
 * @title C
 * @author Publius
 * @notice Contains constants used throughout Beanstalk.
 */
library C {
    using Decimal for Decimal.D256;

    //////////////////// Globals ////////////////////

    uint256 internal constant PRECISION = 1e18;
    uint256 private constant LEGACY_CHAIN_ID = 1;
    uint256 private constant CHAIN_ID = 1;

    //////////////////// Reentrancy ////////////////////
    uint256 internal constant NOT_ENTERED = 1;
    uint256 internal constant ENTERED = 2;

    //////////////////// Season ////////////////////

    /// @dev The length of a Season meaured in seconds.
    uint256 private constant CURRENT_SEASON_PERIOD = 3600; // 1 hour
    uint256 internal constant SOP_PRECISION = 1e30;

    //////////////////// Silo ////////////////////
    uint256 internal constant STALK_PER_BEAN = 1e10;
    uint256 private constant ROOTS_BASE = 1e12;

    //////////////////// Exploit Migration ////////////////////

    uint256 private constant UNRIPE_LP_PER_DOLLAR = 1884592; // 145_113_507_403_282 / 77_000_000
    uint256 private constant ADD_LP_RATIO = 866616;
    uint256 private constant INITIAL_HAIRCUT = 185564685220298701;

    //////////////////// Contracts ////////////////////

    address internal constant BEAN = 0xe64718A6d44406dE942d3d0f591E370B22263382;
    address internal constant CURVE_BEAN_METAPOOL = 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49;

    address internal constant UNRIPE_BEAN = 0x9dBA4d8D19a35c5cf191C3F93a0C112e75a627E4;
    address internal constant UNRIPE_LP = 0xECA13f8A535876C8293B0E140B56fFe5768c5816;

    address private constant FERTILIZER = 0xC59f881074Bf039352C227E21980317e6b969c8A;
    address private constant FERTILIZER_ADMIN = 0xfECB01359263C12Aa9eD838F878A596F0064aa6e;

    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant WSTETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address internal constant PIPELINE = 0xb1bE000644bD25996b0d9C2F7a6D6BA3954c91B0;

    //////////////////// Well ////////////////////

    uint256 internal constant WELL_MINIMUM_BEAN_BALANCE = 1000_000_000; // 1,000 Beans
    address internal constant BEAN_ETH_WELL = 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd;
    address internal constant BEAN_WSTETH_WELL = 0xBeA0000113B0d182f4064C86B71c315389E4715D;

    //////////////////// Chainlink Oracles ////////////////////
    address constant ETH_USD_CHAINLINK_PRICE_AGGREGATOR =
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR =
        0x86392dC19c0b719886221c78AB11eb8Cf5c52812;

    /////////////////fo/////
    address internal constant WSTETH_ETH_UNIV3_01_POOL = 0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa; // 0.01% pool

    //////////////////// Tractor ////////////////////

    uint80 internal constant SLOT_SIZE = 32;
    // Special index to indicate the data to copy is the publisher address.
    uint80 internal constant PUBLISHER_COPY_INDEX = type(uint80).max;
    // Special index to indicate the data to copy is the operator address.
    uint80 internal constant OPERATOR_COPY_INDEX = type(uint80).max - 1;

    function getSeasonPeriod() internal pure returns (uint256) {
        return CURRENT_SEASON_PERIOD;
    }

    function getChainId() internal pure returns (uint256) {
        return CHAIN_ID;
    }

    function getLegacyChainId() internal pure returns (uint256) {
        return LEGACY_CHAIN_ID;
    }

    function getRootsBase() internal pure returns (uint256) {
        return ROOTS_BASE;
    }

    function unripeBean() internal pure returns (IERC20) {
        return IERC20(UNRIPE_BEAN);
    }

    function unripeLP() internal pure returns (IERC20) {
        return IERC20(UNRIPE_LP);
    }

    function bean() internal pure returns (IBean) {
        return IBean(BEAN);
    }

    function fertilizer() internal pure returns (IFertilizer) {
        return IFertilizer(FERTILIZER);
    }

    function fertilizerAddress() internal pure returns (address) {
        return FERTILIZER;
    }

    function fertilizerAdmin() internal pure returns (IProxyAdmin) {
        return IProxyAdmin(FERTILIZER_ADMIN);
    }

    function unripeLPPerDollar() internal pure returns (uint256) {
        return UNRIPE_LP_PER_DOLLAR;
    }

    function dollarPerUnripeLP() internal pure returns (uint256) {
        return 1e12 / UNRIPE_LP_PER_DOLLAR;
    }

    function exploitAddLPRatio() internal pure returns (uint256) {
        return ADD_LP_RATIO;
    }

    function precision() internal pure returns (uint256) {
        return PRECISION;
    }

    function initialRecap() internal pure returns (uint256) {
        return INITIAL_HAIRCUT;
    }
}
