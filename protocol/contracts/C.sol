// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./interfaces/IBean.sol";
import "./interfaces/ICurve.sol";
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
    using SafeMath for uint256;

    //////////////////// Globals ////////////////////

    uint256 internal constant PRECISION = 1e18;
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

    address private constant CURVE_3_POOL = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    address private constant THREE_CRV = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;

    address private constant FERTILIZER = 0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6;
    address private constant FERTILIZER_ADMIN = 0xfECB01359263C12Aa9eD838F878A596F0064aa6e;

    address private constant TRI_CRYPTO = 0xc4AD29ba4B3c580e6D59105FFf484999997675Ff;
    address private constant TRI_CRYPTO_POOL = 0xD51a44d3FaE010294C616388b506AcdA1bfAAE46;
    address private constant CURVE_ZAP = 0xA79828DF1850E8a3A3064576f380D90aECDD3359;

    address private constant UNRIPE_CURVE_BEAN_LUSD_POOL = 0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D;
    address private constant UNRIPE_CURVE_BEAN_METAPOOL = 0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;

    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant UNIV3_ETH_USDC_POOL = 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640; // 0.05% pool
    address internal constant UNIV3_ETH_USDT_POOL = 0x11b815efB8f581194ae79006d24E0d814B7697F6; // 0.05% pool

    // Use external contract for block.basefee as to avoid upgrading existing contracts to solidity v8
    address private constant BASE_FEE_CONTRACT = 0x84292919cB64b590C0131550483707E43Ef223aC;

    //////////////////// Well ////////////////////

    uint256 internal constant WELL_MINIMUM_BEAN_BALANCE = 1000_000_000; // 1,000 Beans
    address internal constant BEANSTALK_PUMP = 0xBA510f10E3095B83a0F33aa9ad2544E22570a87C;
    address internal constant BEAN_ETH_WELL = 0xBEA0e11282e2bB5893bEcE110cF199501e872bAd;
    // The index of the Bean and Weth token addresses in all BEAN/ETH Wells.
    uint256 internal constant BEAN_INDEX = 0;
    uint256 internal constant ETH_INDEX = 1;

    function getSeasonPeriod() internal pure returns (uint256) {
        return CURRENT_SEASON_PERIOD;
    }

    function getBlockLengthSeconds() internal pure returns (uint256) {
        return BLOCK_LENGTH_SECONDS;
    }

    function getChainId() internal pure returns (uint256) {
        return CHAIN_ID;
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

    /**
     * @dev The pre-exploit BEAN:3CRV Curve metapool address.
     */
    function unripeLPPool1() internal pure returns (address) {
        return UNRIPE_CURVE_BEAN_METAPOOL;
    }

    /**
     * @dev The pre-exploit BEAN:LUSD Curve plain pool address.
     */
    function unripeLPPool2() internal pure returns (address) {
        return UNRIPE_CURVE_BEAN_LUSD_POOL;
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

    function curveMetapool() internal pure returns (ICurvePool) {
        return ICurvePool(CURVE_BEAN_METAPOOL);
    }

    function curve3Pool() internal pure returns (I3Curve) {
        return I3Curve(CURVE_3_POOL);
    }
    
    function curveZap() internal pure returns (ICurveZap) {
        return ICurveZap(CURVE_ZAP);
    }

    function curveZapAddress() internal pure returns (address) {
        return CURVE_ZAP;
    }

    function curve3PoolAddress() internal pure returns (address) {
        return CURVE_3_POOL;
    }

    function threeCrv() internal pure returns (IERC20) {
        return IERC20(THREE_CRV);
    }

    function UniV3EthUsdc() internal pure returns (address){
        return UNIV3_ETH_USDC_POOL;
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

    function triCryptoPoolAddress() internal pure returns (address) {
        return TRI_CRYPTO_POOL;
    }

    function triCrypto() internal pure returns (IERC20) {
        return IERC20(TRI_CRYPTO);
    }

    function unripeLPPerDollar() internal pure returns (uint256) {
        return UNRIPE_LP_PER_DOLLAR;
    }

    function dollarPerUnripeLP() internal pure returns (uint256) {
        return 1e12/UNRIPE_LP_PER_DOLLAR;
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