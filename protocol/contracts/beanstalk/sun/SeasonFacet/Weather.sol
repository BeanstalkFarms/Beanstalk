// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Decimal.sol";
import "~/libraries/Curve/LibBeanMetaCurve.sol";
import "./Sun.sol";

library DecimalExtended {
    uint256 private constant PERCENT_BASE = 1e18;

    function toDecimal(uint256 a) internal pure returns (Decimal.D256 memory) {
        return Decimal.ratio(a, PERCENT_BASE);
    }
}

/**
 * @title Weather
 * @author Publius
 * @notice Weather controls the Temperature on the Farm.
 */
contract Weather is Sun {
    using SafeMath for uint256;
    using DecimalExtended for uint256;
    using LibSafeMath32 for uint32;
    using Decimal for Decimal.D256;

    /// @dev If all Soil is Sown faster than this, Beanstalk considers demand for Soil to be increasing.
    uint256 private constant SOW_TIME_DEMAND_INCR = 600; // seconds

    /// @dev
    uint32 private constant SOW_TIME_STEADY = 60; // seconds

    uint256 private constant POD_RATE_LOWER_BOUND = 0.05e18; // 5%
    uint256 private constant OPTIMAL_POD_RATE = 0.15e18; // 15%
    uint256 private constant POD_RATE_UPPER_BOUND = 0.25e18; // 25%
    
    /**
     * @notice Emitted when the Temperature (fka "Weather") changes.
     * @param season The current Season
     * @param caseId The Weather case, which determines how much the Temperature is adjusted.
     * @param change The change in Temperature as a delta from the previous value
     * @dev The name {WeatherChange} is kept for backwards compatibility, 
     * however the state variable included as `change` is now called Temperature.
     * 
     * `change` is emitted as a delta for gas efficiency.
     */
    event WeatherChange(
        uint256 indexed season,
        uint256 caseId,
        int8 change
    );

    /**
     * @notice Emitted when Beans are minted during the Season of Plenty.
     * @param season The Season in which Beans were minted for distribution.
     * @param amount The amount of 3CRV which was received for swapping Beans.
     * @param toField The amount of Beans which were distributed to remaining Pods in the Field.
     */
    event SeasonOfPlenty(
        uint256 indexed season,
        uint256 amount,
        uint256 toField
    );


    //////////////////// WEATHER GETTERS ////////////////////

    /**
     * @notice Returns the current Weather struct. See {AppStorage:Storage.Weather}.
     */
    function weather() public view returns (Storage.Weather memory) {
        return s.w;
    }

    /**
     * @notice Returns the current Rain struct. See {AppStorage:Storage.Rain}.
     */
    function rain() public view returns (Storage.Rain memory) {
        return s.r;
    }

    /**
     * @notice Returns the Plenty per Root for `season`.
     */
    function plentyPerRoot(uint32 season) external view returns (uint256) {
        return s.sops[season];
    }

    //////////////////// WEATHER INTERNAL ////////////////////

    /**
     * @param deltaB Pre-calculated deltaB from {Oracle.stepOracle}.
     * @dev A detailed explanation of the Weather mechanism can be found in the
     * Beanstalk whitepaper. An explanation of state variables can be found in {AppStorage}.
     */
    function stepWeather(int256 deltaB) internal returns (uint256 caseId) {
        uint256 beanSupply = C.bean().totalSupply();

        // Prevent infinite pod rate
        if (beanSupply == 0) {
            s.w.t = 1;
            return 8; // Reasonably low
        }

        // Calculate Pod Rate
        Decimal.D256 memory podRate = Decimal.ratio(
            s.f.pods.sub(s.f.harvestable), // same as totalUnharvestable()
            beanSupply
        );

        // Calculate Delta Soil Demand
        uint256 dsoil = s.f.beanSown;
        s.f.beanSown = 0;
    
        Decimal.D256 memory deltaPodDemand;

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

            s.w.lastSowTime = s.w.thisSowTime;  // Overwrite last Season
            s.w.thisSowTime = type(uint32).max; // Reset for next Season
        } 

        // Soil didn't sell out
        else {
            uint256 lastDSoil = s.w.lastDSoil;

            if (dsoil == 0) {
                deltaPodDemand = Decimal.zero(); // If no one sow'd
            } else if (lastDSoil == 0) {
                deltaPodDemand = Decimal.from(1e18); // If no one sow'd last Season
            } else { 
                deltaPodDemand = Decimal.ratio(dsoil, lastDSoil);
            }

            if (s.w.lastSowTime != type(uint32).max) {
                s.w.lastSowTime = type(uint32).max;
            }
        }
        
        // Calculate Weather Case
        caseId = 0;

        // Evaluate Pod Rate
        if (podRate.greaterThanOrEqualTo(POD_RATE_UPPER_BOUND.toDecimal())) {
            caseId = 24;
        } else if (podRate.greaterThanOrEqualTo(OPTIMAL_POD_RATE.toDecimal())) {
            caseId = 16;
        } else if (podRate.greaterThanOrEqualTo(POD_RATE_LOWER_BOUND.toDecimal())) {
            caseId = 8;
        }

        // Evaluate Price
        if (
            deltaB > 0 ||
            (deltaB == 0 && podRate.lessThanOrEqualTo(OPTIMAL_POD_RATE.toDecimal()))
        ) {
            caseId += 4;
        }

        // Evaluate Delta Soil Demand
        if (deltaPodDemand.greaterThanOrEqualTo(C.getUpperBoundDPD())) {
            caseId += 2;
        } else if (deltaPodDemand.greaterThanOrEqualTo(C.getLowerBoundDPD())) {
            caseId += 1;
        }

        s.w.lastDSoil = uint128(dsoil);
        
        changeWeather(caseId);
        handleRain(caseId);
    }

    /**
     * @dev Changes the current Temperature `s.w.t` based on the Weather Case.
     */
    function changeWeather(uint256 caseId) private {
        int8 change = s.cases[caseId];
        uint32 t = s.w.t;

        if (change < 0) {
            if (t <= (uint32(-change))) {
                // if (change < 0 && t <= uint32(-change)),
                // then 0 <= t <= type(int8).max because change is an int8.
                // Thus, downcasting t to an int8 will not cause overflow.
                change = 1 - int8(t);
                s.w.t = 1;
            } else {
                s.w.t = t - (uint32(-change));
            }
        } else {
            s.w.t = t + (uint32(change));
        }

        emit WeatherChange(s.season.current, caseId, change);
    }

    /**
     * @dev Update Rain state based on the current state and Weather Case.
     */
    function handleRain(uint256 caseId) internal {
        if (caseId < 4 || caseId > 7) {
            if (s.season.raining) {
                s.season.raining = false;
            }
            return;
        } else if (!s.season.raining) {
            s.season.raining = true;
            // Set the plenty per root equal to previous rain start.
            s.sops[s.season.current] = s.sops[s.season.rainStart];
            s.season.rainStart = s.season.current;
            s.r.pods = s.f.pods;
            s.r.roots = s.s.roots;
        } else if (
            s.season.current >= s.season.rainStart.add(s.season.withdrawSeasons - 1)
        ) {
            if (s.r.roots > 0) {
                sop();
            }
        }
    }

    /**
     * @dev Sell Beans on the Curve pool for 3CRV.
     */
    function sop() private {
        int256 newBeans = LibBeanMetaCurve.getDeltaB();
        if (newBeans <= 0) return;

        uint256 sopBeans = uint256(newBeans);
        uint256 newHarvestable;

        // Pay off remaining Pods if any exist.
        if (s.f.harvestable < s.r.pods) {
            newHarvestable = s.r.pods - s.f.harvestable;
            s.f.harvestable = s.f.harvestable.add(newHarvestable);
            C.bean().mint(address(this), newHarvestable.add(sopBeans));
        } else {
            C.bean().mint(address(this), sopBeans);
        }

        // Swap Beans for 3CRV.
        uint256 amountOut = C.curveMetapool().exchange(0, 1, sopBeans, 0);

        rewardSop(amountOut);
        emit SeasonOfPlenty(s.season.current, amountOut, newHarvestable);
    }

    /**
     * @dev Allocate 3CRV during a Season of Plenty.
     */
    function rewardSop(uint256 amount) private {
        s.sops[s.season.rainStart] = s.sops[s.season.lastSop].add(
            amount.mul(C.getSopPrecision()).div(s.r.roots)
        );
        s.season.lastSop = s.season.rainStart;
        s.season.lastSopSeason = s.season.current;
    }
}
