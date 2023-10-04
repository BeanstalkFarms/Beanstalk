// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";
import {Decimal, SafeMath} from "contracts/libraries/Decimal.sol";
import {LibWhitelistedTokens, C} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUsdOracle, LibEthUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibBeanEthWellOracle} from "contracts/libraries/Oracle/LibBeanEthWellOracle.sol"; 
import {LibBeanMetaCurve} from "contracts/libraries/Curve/LibBeanMetaCurve.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibWell, IInstantaneousPump} from "contracts/libraries/Well/LibWell.sol";

/**
 * @author Brean
 * @title LibEvaluate calculates the caseId based on the state of beanstalk.
 * @dev the current parameters that beanstalk uses to evaluate its state are:
 * - deltaB, the amount of beans needed to be bought/sold to reach peg.
 * - podRate, the ratio of pods outstanding against the bean supply.
 * - delta Soil demand, the change in demand of soil between the current and previous season.
 * - lpToSupplyRatio, the ratio of liquidity against the bean supply.
 *
 * based on the caseId, beanstalk adjusts:
 * - the temperature
 * - the stalk issued per bdv per season for LP and Bean.
 */

library DecimalExtended {
    uint256 private constant PERCENT_BASE = 1e18;

    function toDecimal(uint256 a) internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({ value: a });
    }
}

library LibEvaluate {
    using SafeMath for uint256;
    using DecimalExtended for uint256;
    using Decimal for Decimal.D256;
    using LibSafeMath32 for uint32;

    // Pod rate bounds
    uint256 internal constant POD_RATE_LOWER_BOUND = 0.05e18; // 5%
    uint256 internal constant POD_RATE_OPTIMAL = 0.15e18; // 15%
    uint256 internal constant POD_RATE_UPPER_BOUND = 0.25e18; // 25%
    
    // Change in soil demand bounds
    uint256 internal constant DELTA_POD_DEMAND_LOWER_BOUND = 0.95e18; // 95%
    uint256 internal constant DELTA_POD_DEMAND_UPPER_BOUND = 1.05e18; // 105%

    /// @dev If all Soil is Sown faster than this, Beanstalk considers demand for Soil to be increasing.
    uint256 internal constant SOW_TIME_DEMAND_INCR = 600; // seconds

    uint32 internal constant SOW_TIME_STEADY = 60; // seconds

    // Liquidity to supply ratio bounds
    uint256 internal constant LP_TO_SUPPLY_RATIO_UPPER_BOUND = 0.8e18; // 80%
    uint256 internal constant LP_TO_SUPPLY_RATIO_OPTIMAL = 0.4e18; // 40%
    uint256 internal constant LP_TO_SUPPLY_RATIO_LOWER_BOUND = 0.12e18; // 12%

    // Excessive price threshold constant
    uint256 internal constant Q = 1.05e6;

    uint256 internal constant LIQUIDITY_PRECISION = 1e12;

    /**
     * @notice evaluates the pod rate and returns the caseId
     * @param podRate the length of the podline (debt), divided by the bean supply. 
     */
    function evalPodRate(Decimal.D256 memory podRate) internal pure returns (uint256 caseId) {
        if (podRate.greaterThanOrEqualTo(POD_RATE_UPPER_BOUND.toDecimal())) {
            caseId = 27;
        } else if (podRate.greaterThanOrEqualTo(POD_RATE_OPTIMAL.toDecimal())) {
            caseId = 18;
        } else if (podRate.greaterThanOrEqualTo(POD_RATE_LOWER_BOUND.toDecimal())) {
            caseId = 9;
        }
    }

    /**
     * @notice updates the caseId based on the price of bean (deltaB)
     * @param deltaB the amount of beans needed to be sold or bought to get bean to peg.
     * @param podRate the length of the podline (debt), divided by the bean supply.
     */
    function evalPrice(
        int256 deltaB, 
        Decimal.D256 memory podRate
    ) internal view returns (uint256 caseId) {
        // p > 1
        if (deltaB > 0 || (deltaB == 0 && podRate.lessThanOrEqualTo(POD_RATE_OPTIMAL.toDecimal()))) {
            // beanstalk will only use the bean/eth well to compute the bean price, 
            // and thus will skip the p>q check if the bean/eth oracle fails to 
            // compute a valid price this Season. 
            uint256 beanEthPrice = LibBeanEthWellOracle.getBeanEthWellPrice();
            if(beanEthPrice > 1){
                uint256 beanUsdPrice = LibEthUsdOracle.getUsdEthPrice().mul(beanEthPrice).div(1e18);
                if(beanUsdPrice > Q){
                    // p > q
                    return caseId = 6;
                }
            }
            caseId = 3;
        }
        // p < 1
    }

    /**
     * @notice updates the caseId based on the change in soil demand. 
     * @param caseId the inital caseId
     * @param deltaPodDemand the change in soil demand from the previous season.
     */
    function evalDeltaPodDemand(
        Decimal.D256 memory deltaPodDemand
    ) internal pure returns (uint256 caseId) {
        // increasing
        if (deltaPodDemand.greaterThanOrEqualTo(DELTA_POD_DEMAND_UPPER_BOUND.toDecimal())) {
            caseId = 2;
        // steady
        } else if (deltaPodDemand.greaterThanOrEqualTo(DELTA_POD_DEMAND_LOWER_BOUND.toDecimal())) {
            caseId = 1;
        }
        // decreasing 
    }
    
    /**
     * @notice evaluates the lp to supply ratio and returns the caseId
     * @param lpToSupplyRatio the ratio of liquidity to supply.
     */
    function evalLpToSupplyRatio(
        Decimal.D256 memory lpToSupplyRatio
    ) internal pure returns (uint256 caseId) {
        // Extremely High
        if (lpToSupplyRatio.greaterThanOrEqualTo(LP_TO_SUPPLY_RATIO_UPPER_BOUND.toDecimal())) {
            caseId = 108;
        // Reasonably High
        } else if (lpToSupplyRatio.greaterThanOrEqualTo(LP_TO_SUPPLY_RATIO_OPTIMAL.toDecimal())) {
            caseId = 72;
        // Reasonably Low
        } else if (lpToSupplyRatio.greaterThanOrEqualTo(LP_TO_SUPPLY_RATIO_LOWER_BOUND.toDecimal())) {
            caseId = 36;
        }
        // excessively low (caseId = 0)
    }

    /**
     * @notice calculates the change in soil demand from the previous season.
     * @param dsoil the amount of soil sown this season.
     */
    function calcDeltaPodDemand(
        uint256 dsoil
    ) internal view returns (
        Decimal.D256 memory deltaPodDemand,
        uint32 lastSowTime,
        uint32 thisSowTime
    ) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // `s.w.thisSowTime` is set to the number of seconds in it took for 
        // Soil to sell out during the current Season. If Soil didn't sell out,
        // it remains `type(uint32).max`.
        if (s.w.thisSowTime < type(uint32).max) {
            if (
                s.w.lastSowTime == type(uint32).max || // Didn't Sow all last Season
                s.w.thisSowTime < SOW_TIME_DEMAND_INCR || // Sow'd all instantly this Season
                (s.w.lastSowTime > SOW_TIME_STEADY &&
                    s.w.thisSowTime < s.w.lastSowTime.sub(SOW_TIME_STEADY)) // Sow'd all faster
            ) {
                deltaPodDemand = Decimal.from(1e18);
            } else if (
                s.w.thisSowTime <= s.w.lastSowTime.add(SOW_TIME_STEADY)
            ) {
                // Sow'd all in same time
                deltaPodDemand = Decimal.one();
            } else { 
                deltaPodDemand = Decimal.zero();
            }
            lastSowTime = s.w.thisSowTime;  // Overwrite last Season
        } else {  // Soil didn't sell out
            uint256 lastDSoil = s.w.lastDSoil;

            if (dsoil == 0) {
                deltaPodDemand = Decimal.zero(); // If no one sow'd
            } else if (lastDSoil == 0) {
                deltaPodDemand = Decimal.from(1e18); // If no one sow'd last Season
            } else { 
                deltaPodDemand = Decimal.ratio(dsoil, lastDSoil);
            }
            
            if (s.w.lastSowTime != type(uint32).max) {
                lastSowTime = type(uint32).max;
            }
        }
        thisSowTime = type(uint32).max; // Reset for next Season
    }

    /**
     * @notice calculates the liquidity to supply ratio, where liquidity is measured in USD. 
     * @param beanSupply the total supply of beans.
     * @dev no support for non-well AMMs.
     */
    function calcLPToSupplyRatio(
        uint256 beanSupply
    ) internal view returns (
        Decimal.D256 memory lpToSupplyRatio
    ) {
        // prevent infinite L2SR 
        if (beanSupply == 0) return Decimal.zero();

        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory pools = LibWhitelistedTokens.getSiloLPTokens();
        uint256 usdLiquidity;
        for (uint256 i; i < pools.length; i++) {
            // get the non-bean value in an LP.
            if (LibWell.isWell(pools[i])) {
                usdLiquidity = usdLiquidity.add(LibWell.getUsdLiquidity(pools[i]));
            } else if (pools[i] == C.CURVE_BEAN_METAPOOL) {
                usdLiquidity = usdLiquidity.add(LibBeanMetaCurve.totalLiquidityUsd());
            }
        }

        // if there is no liquidity, 
        // return 0 to save gas.
        if (usdLiquidity == 0) return Decimal.zero();

        // scale down bean supply by the locked beans, if there is fertilizer to be paid off.
        if (s.season.fertilizing == true) {
            beanSupply = beanSupply.sub(LibUnripe.getLockedBeans());
        }
        // usd liquidity is scaled down from 1e18 to match bean precision (1e6).
        lpToSupplyRatio = Decimal.ratio(usdLiquidity.div(LIQUIDITY_PRECISION), beanSupply);
    }

     /**
     * @notice get the deltaPodDemand, lpToSupplyRatio, and podRate, 
     * and update soil demand parameters.
     */
    function getBeanstalkState(uint256 beanSupply) 
        internal returns (
            Decimal.D256 memory deltaPodDemand,
            Decimal.D256 memory lpToSupplyRatio,
            Decimal.D256 memory podRate
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Calculate Delta Soil Demand
        uint256 dsoil = s.f.beanSown;
        s.f.beanSown = 0;
        (deltaPodDemand, s.w.lastSowTime, s.w.thisSowTime) = calcDeltaPodDemand(dsoil);
        s.w.lastDSoil = uint128(dsoil); // SafeCast not necessary as `s.f.beanSown` is uint128.

        // Calculate Lp To Supply Ratio
        lpToSupplyRatio = calcLPToSupplyRatio(beanSupply);

        // Calculate PodRate   
        podRate = Decimal.ratio(s.f.pods.sub(s.f.harvestable), beanSupply); // Pod Rate
    }
    /**
     * @notice evaluates beanstalk based on deltaB, podRate, deltaPodDemand and lpToSupplyRatio.
     * and returns the associated caseId.
     */
    function evaluateBeanstalk(
        int256 deltaB,
        uint256 beanSupply
    ) internal returns (uint256 caseId) {
        (
            Decimal.D256 memory deltaPodDemand, 
            Decimal.D256 memory lpToSupplyRatio, 
            Decimal.D256 memory podRate
        ) = getBeanstalkState(beanSupply);
        caseId = evalPodRate(podRate)  // Evaluate Pod Rate
            .add(evalPrice(deltaB, podRate)) // Evaluate Price
            .add(evalDeltaPodDemand(deltaPodDemand)) // Evaluate Delta Soil Demand
            .add(evalLpToSupplyRatio(lpToSupplyRatio)); // Evaluate LP to Supply Ratio
    }
}