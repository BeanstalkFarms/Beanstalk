/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./interfaces/IBean.sol";
import "./interfaces/ICurve.sol";
import "./libraries/Decimal.sol";

/**
 * @author Publius
 * @title C holds the contracts for Beanstalk.
**/
library C {

    using Decimal for Decimal.D256;
    using SafeMath for uint256;

    // Constants
    uint256 private constant PERCENT_BASE = 1e18; // Mainnet

    // Chain
    uint256 private constant CHAIN_ID = 1; // Mainnet

    // Season
    uint256 private constant CURRENT_SEASON_PERIOD = 3600; // 1 hour
    uint256 private constant BASE_ADVANCE_INCENTIVE = 100e6; // 100 beans
    uint256 private constant SOP_PRECISION = 1e24;

    // Sun
    uint256 private constant SPROUT_DENOMINATOR = 3;
    uint256 private constant HARVEST_DENOMINATOR =2;

    // Weather
    uint256 private constant POD_RATE_LOWER_BOUND = 0.05e18; // 5%
    uint256 private constant OPTIMAL_POD_RATE = 0.15e18; // 15%
    uint256 private constant POD_RATE_UPPER_BOUND = 0.25e18; // 25%
    uint32 private constant STEADY_SOW_TIME = 60; // 1 minute

    uint256 private constant DELTA_POD_DEMAND_LOWER_BOUND = 0.95e18; // 95%
    uint256 private constant DELTA_POD_DEMAND_UPPER_BOUND = 1.05e18; // 105%

    // Silo
    uint256 private constant SEEDS_PER_BEAN = 2;
    uint256 private constant SEEDS_PER_LP_BEAN = 4;
    uint256 private constant STALK_PER_BEAN = 10000;
    uint256 private constant ROOTS_BASE = 1e12;

    // Contracts
    address private constant BEAN = 0xDC59ac4FeFa32293A95889Dc396682858d52e5Db;
    address private constant CURVE_BEAN_METAPOOL = 0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;
    address private constant CURVE_BEAN_LUSD_POOL = 0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D;
    address private constant CURVE_3_POOL = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    address private constant THREE_CRV = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;
    address private constant UNRIPE_BEAN = 0xD5BDcdEc5b2FEFf781eA8727969A95BbfD47C40e;
    address private constant UNRIPE_LP = 0x2e4243832DB30787764f152457952C8305f442e4;
    address private constant SPROUT = 0x2E4243832db30787764F152457952C8305f442E5;

    /**
     * Getters
    **/

    function getSeasonPeriod() internal pure returns (uint256) {
        return CURRENT_SEASON_PERIOD;
    }

    function getAdvanceIncentive() internal pure returns (uint256) {
        return BASE_ADVANCE_INCENTIVE;
    }

    function getSproutDenominator() internal pure returns (uint256) {
        return SPROUT_DENOMINATOR;
    }

    function getHarvestDenominator() internal pure returns (uint256) {
        return HARVEST_DENOMINATOR;
    }

    function getChainId() internal pure returns (uint256) {
        return CHAIN_ID;
    }

    function getOptimalPodRate() internal pure returns (Decimal.D256 memory) {
        return Decimal.ratio(OPTIMAL_POD_RATE, PERCENT_BASE);
    }

    function getUpperBoundPodRate() internal pure returns (Decimal.D256 memory) {
        return Decimal.ratio(POD_RATE_UPPER_BOUND, PERCENT_BASE);
    }

    function getLowerBoundPodRate() internal pure returns (Decimal.D256 memory) {
        return Decimal.ratio(POD_RATE_LOWER_BOUND, PERCENT_BASE);
    }

    function getUpperBoundDPD() internal pure returns (Decimal.D256 memory) {
        return Decimal.ratio(DELTA_POD_DEMAND_UPPER_BOUND, PERCENT_BASE);
    }

    function getLowerBoundDPD() internal pure returns (Decimal.D256 memory) {
        return Decimal.ratio(DELTA_POD_DEMAND_LOWER_BOUND, PERCENT_BASE);
    }

    function getSteadySowTime() internal pure returns (uint32) {
        return STEADY_SOW_TIME;
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

    function getSopPrecision() internal pure returns (uint256) {
        return SOP_PRECISION;
    }

    function beanAddress() internal pure returns (address) {
        return BEAN;
    }

    function curveMetapoolAddress() internal pure returns (address) {
        return CURVE_BEAN_METAPOOL;
    }

    function curveBeanLUSDAddress() internal pure returns (address) {
        return CURVE_BEAN_LUSD_POOL;
    }

    function unripeBeanAddress() internal pure returns (address) {
        return UNRIPE_BEAN;
    }

    function unripeLPAddress() internal pure returns (address) {
        return UNRIPE_LP;
    }

    function bean() internal pure returns (IBean) {
        return IBean(BEAN);
    }

    function curveMetapool() internal pure returns (ICurvePool) {
        return ICurvePool(CURVE_BEAN_METAPOOL);
    }

    function curve3Pool() internal pure returns (I3Curve) {
        return I3Curve(CURVE_3_POOL);
    }

    function threeCrv() internal pure returns (IERC20) {
        return IERC20(THREE_CRV);
    }
    
    function sprout() internal pure returns (IERC20) {
        return IERC20(SPROUT);
    }
}
