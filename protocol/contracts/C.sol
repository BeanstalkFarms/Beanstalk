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
    bytes constant BYTES_ZERO = new bytes(0);

    /// @dev The block time for the chain in seconds.
    uint256 internal constant BLOCK_LENGTH_SECONDS = 12;

    //////////////////// Season ////////////////////

    /// @dev The length of a Season meaured in seconds.
    uint256 private constant CURRENT_SEASON_PERIOD = 3600; // 1 hour
    uint256 internal constant SOP_PRECISION = 1e24;

    //////////////////// Silo ////////////////////

    uint256 internal constant SEEDS_PER_BEAN = 2;
    uint256 internal constant STALK_PER_BEAN = 10000;
    uint256 private constant ROOTS_BASE = 1e12;

    //////////////////// Exploit Migration ////////////////////

    uint256 private constant UNRIPE_LP_PER_DOLLAR = 1884592; // 145_113_507_403_282 / 77_000_000
    uint256 private constant ADD_LP_RATIO = 866616;
    uint256 private constant INITIAL_HAIRCUT = 185564685220298701;

    //////////////////// Contracts ////////////////////

    address internal constant BEAN = 0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab;
    address internal constant CURVE_BEAN_METAPOOL = 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49;

    address internal constant UNRIPE_BEAN = 0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449;
    address internal constant UNRIPE_LP = 0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D;

    address private constant FERTILIZER = 0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6;
    address private constant FERTILIZER_ADMIN = 0xfECB01359263C12Aa9eD838F878A596F0064aa6e;

    address private constant UNRIPE_CURVE_BEAN_LUSD_POOL =
        0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D;
    address private constant UNRIPE_CURVE_BEAN_METAPOOL =
        0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;

    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant WSTETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address internal constant PIPELINE = 0xb1bE0000C6B3C62749b5F0c92480146452D15423;

    //////////////////// Well ////////////////////

    uint256 internal constant WELL_MINIMUM_BEAN_BALANCE = 1000_000_000; // 1,000 Beans
    address internal constant MULTIFLOW_PUMP_V1 = 0xBA510f10E3095B83a0F33aa9ad2544E22570a87C;
    address internal constant BEAN_ETH_WELL = 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd;
    address internal constant BEAN_WSTETH_WELL = 0xa61Ef2313C1eC9c8cf2E1cAC986539d136b1393E; // TODO: Set
    // The index of the Bean and Weth token addresses in all BEAN/ETH Wells.
    uint256 internal constant BEAN_INDEX = 0;
    uint256 internal constant ETH_INDEX = 1;

    //////////////////// Chainlink Oracles ////////////////////
    address constant ETH_USD_CHAINLINK_PRICE_AGGREGATOR =
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR =
        0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
    address constant USDC_CHAINLINK_PRICE_AGGREGATOR = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address constant USDT_CHAINLINK_PRICE_AGGREGATOR = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D;

    //////////////////// Uniswap Oracles //////////////////////
    address internal constant WSTETH_ETH_UNIV3_01_POOL = 0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa; // 0.01% pool

    //////////////////// Tractor ////////////////////

    uint80 internal constant SELECTOR_SIZE = 4;
    uint80 internal constant SLOT_SIZE = 32;
    uint80 internal constant ARGS_START_INDEX = SELECTOR_SIZE + SLOT_SIZE;
    uint80 internal constant ADDR_SLOT_OFFSET = 12;
    // Special index to indicate the data to copy is the publisher address.
    uint80 internal constant PUBLISHER_COPY_INDEX = type(uint80).max;
    // Special index to indicate the data to copy is the operator address.
    uint80 internal constant OPERATOR_COPY_INDEX = type(uint80).max - 1;

    function getSeasonPeriod() internal pure returns (uint256) {
        return CURRENT_SEASON_PERIOD;
    }

    function getBlockLengthSeconds() internal pure returns (uint256) {
        return BLOCK_LENGTH_SECONDS;
    }

    function getChainId() internal pure returns (uint256) {
        return CHAIN_ID;
    }

    function getLegacyChainId() internal pure returns (uint256) {
        return LEGACY_CHAIN_ID;
    }

    function getSeedsPerBean() internal pure returns (uint256) {
        return SEEDS_PER_BEAN;
    }

    function getStalkPerBean() internal pure returns (uint256) {
        return STALK_PER_BEAN;
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

    function usdc() internal pure returns (IERC20) {
        return IERC20(USDC);
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
