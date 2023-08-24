// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";
import {Decimal, SafeMath} from "contracts/libraries/Decimal.sol";
import "contracts/libraries/LibSafeMath32.sol";


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
    uint256 private constant POD_RATE_LOWER_BOUND = 0.05e18; // 5%
    uint256 private constant POD_RATE_OPTIMAL = 0.15e18; // 15%
    uint256 private constant POD_RATE_UPPER_BOUND = 0.25e18; // 25%
    
    // Change in soil demand bounds
    uint256 private constant DELTA_POD_DEMAND_LOWER_BOUND = 0.95e18; // 95%
    uint256 private constant DELTA_POD_DEMAND_UPPER_BOUND = 1.05e18; // 105%

    /// @dev If all Soil is Sown faster than this, Beanstalk considers demand for Soil to be increasing.
    uint256 private constant SOW_TIME_DEMAND_INCR = 600; // seconds

    uint32 private constant SOW_TIME_STEADY = 60; // seconds

    uint256 private constant LP_TO_SUPPLY_RATIO_UPPER_BOUND = 0.75e18; // 75%
    uint256 private constant LP_TO_SUPPLY_RATIO_OPTIMAL = 0.5e18; // 50%
    uint256 private constant LP_TO_SUPPLY_RATIO_LOWER_BOUND = 0.25e18; // 25%

    /**
     * @notice evaluates the pod rate and returns the caseId
     * @param podRate the length of the podline (debt), divided by the bean supply. 
     */
    function evalPodRate(Decimal.D256 memory podRate) internal pure returns (uint256 caseId) {
        if (podRate.greaterThanOrEqualTo(POD_RATE_UPPER_BOUND.toDecimal())) {
            caseId = 24;
        } else if (podRate.greaterThanOrEqualTo(POD_RATE_OPTIMAL.toDecimal())) {
            caseId = 16;
        } else if (podRate.greaterThanOrEqualTo(POD_RATE_LOWER_BOUND.toDecimal())) {
            caseId = 8;
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
    ) internal pure returns (uint256 caseId) {
        if (deltaB > 0 || (deltaB == 0 && podRate.lessThanOrEqualTo(POD_RATE_OPTIMAL.toDecimal()))) {
            caseId += 4;
        }
        return caseId;
    }

    /**
     * @notice updates the caseId based on the change in soil demand. 
     * @param caseId the inital caseId
     * @param deltaPodDemand the change in soil demand from the previous season.
     */
    function evalDeltaPodDemand(
        Decimal.D256 memory deltaPodDemand
    ) internal pure returns (uint256 caseId) {
        if (deltaPodDemand.greaterThanOrEqualTo(DELTA_POD_DEMAND_UPPER_BOUND.toDecimal())) {
            caseId += 2;
        } else if (deltaPodDemand.greaterThanOrEqualTo(DELTA_POD_DEMAND_LOWER_BOUND.toDecimal())) {
            caseId += 1;
        }
        return caseId;
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
        caseId += 96;
        // Reasonsably High
        } else if (lpToSupplyRatio.greaterThanOrEqualTo(LP_TO_SUPPLY_RATIO_OPTIMAL.toDecimal())) {
            caseId += 64;
            // Reasonsably Low
        } else if (lpToSupplyRatio.greaterThanOrEqualTo(LP_TO_SUPPLY_RATIO_LOWER_BOUND.toDecimal())) {
            caseId += 32;
        }
	    // Extremely Low -> Add 0

        // for now, set caseId addition to 0
        caseId = 0;
    }

    function calcDeltaPodDemand(
        uint256 dsoil
    )  internal view returns (
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
            thisSowTime = type(uint32).max; // Reset for next Season
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
            thisSowTime = type(uint32).max;
        }
    }

    function calcLPToSupplyRatio(uint256 beanSupply) internal returns (Decimal.D256 memory lpToSupplyRatio) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 lpSupply = 0;
        if (lpSupply == 0) {
            lpToSupplyRatio = Decimal.from(1e18);
        } else {
            lpToSupplyRatio = Decimal.ratio(lpSupply, beanSupply);
        }
    }

    /**
     * @notice evaluates beanstalk based on deltaB, podRate, and deltaPodDemand,
     * and returns the assoicated caseId.
     * @param deltaB the amount of beans needed to be sold or bought to get bean to peg.
     * @param podRate the length of the podline (debt), divided by the bean supply.
     * @param deltaPodDemand the change in soil demand from the previous season.
     */
    function evaluateBeanstalk(
        int256 deltaB,
        Decimal.D256 memory podRate,
        Decimal.D256 memory deltaPodDemand,
        Decimal.D256 memory lpToSupplyRatio
    ) internal pure returns (uint256 caseId) {
        // Calculate Weather Case
        caseId = 0;
        // Evaluate Pod Rate
        caseId = evalPodRate(podRate)
            .add(evalPrice(deltaB, podRate)) // Evaluate Price
            .add(evalDeltaPodDemand(deltaPodDemand)) // Evaluate Delta Soil Demand
            .add(evalLpToSupplyRatio(lpToSupplyRatio)); // Evaluate LP to Supply Ratio
    }
}