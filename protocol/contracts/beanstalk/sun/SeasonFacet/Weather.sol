/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Decimal.sol";
import "~/libraries/Curve/LibBeanMetaCurve.sol";
import "./Sun.sol";

/**
 * @author Publius
 * @title Weather
 **/
contract Weather is Sun {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using Decimal for Decimal.D256;

    uint256 private constant SOWTIMEDEMAND = 600;
    
    event WeatherChange(uint256 indexed season, uint256 caseId, int8 change);
    event SeasonOfPlenty(
        uint256 indexed season,
        uint256 amount,
        uint256 toField
    );

    /**
     * Weather Getters
     **/

    function weather() public view returns (Storage.Weather memory) {
        return s.w;
    }

    function rain() public view returns (Storage.Rain memory) {
        return s.r;
    }

    /// @dev {FieldFacet.yield} has precision 1e8, but maxYield has precision 1e2.
    /// i.e.:
    /// maxYield() = 6674   => 6674% temperature = 66.74
    /// yield()    = 1e6    at t = 0
    ///            = 6674e6 at t >> 0
    function maxYield() public view returns (uint32) {
        return s.w.yield;
    }

    function plentyPerRoot(uint32 season) external view returns (uint256) {
        return s.sops[season];
    }

    /**
     * Weather Internal
     **/

    function stepWeather(int256 deltaB) internal returns (uint256 caseId) {
        uint256 beanSupply = C.bean().totalSupply();
        if (beanSupply == 0) {
            s.w.yield = 1;
            return 8; // Reasonably low
        }

        // Calculate Pod Rate
        Decimal.D256 memory podRate = Decimal.ratio(
            s.f.pods.sub(s.f.harvestable),
            beanSupply
        );

        // Calculate Delta Soil Demand
        uint256 dsoil = s.f.beanSown;
        s.f.beanSown = 0;
    
        Decimal.D256 memory deltaPodDemand;

        // If Sow'd all Soil
        if (s.w.nextSowTime < type(uint32).max) {
            if (
                s.w.lastSowTime == type(uint32).max || // Didn't Sow all last Season
                s.w.nextSowTime < SOWTIMEDEMAND || // Sow'd all instantly this Season
                (s.w.lastSowTime > C.getSteadySowTime() &&
                    s.w.nextSowTime < s.w.lastSowTime.sub(C.getSteadySowTime())) // Sow'd all faster
            ) deltaPodDemand = Decimal.from(1e18);
            else if (
                s.w.nextSowTime <= s.w.lastSowTime.add(C.getSteadySowTime())
            )
                // Sow'd all in same time
                deltaPodDemand = Decimal.one();
            else deltaPodDemand = Decimal.zero();
            s.w.lastSowTime = s.w.nextSowTime;
            s.w.nextSowTime = type(uint32).max;
            // If soil didn't sell out
        } else {
            uint256 lastDSoil = s.w.lastDSoil;
            if (dsoil == 0)
                deltaPodDemand = Decimal.zero(); // If no one sow'd
            else if (lastDSoil == 0)
                deltaPodDemand = Decimal.from(1e18); // If no one sow'd last Season
            else deltaPodDemand = Decimal.ratio(dsoil, lastDSoil);
            if (s.w.lastSowTime != type(uint32).max)
                s.w.lastSowTime = type(uint32).max;
        }
        
        // Calculate Weather Case
        caseId = 0;

        // Evaluate Pod Rate
        if (podRate.greaterThanOrEqualTo(C.getUpperBoundPodRate())) caseId = 24;
        else if (podRate.greaterThanOrEqualTo(C.getOptimalPodRate()))
            caseId = 16;
        else if (podRate.greaterThanOrEqualTo(C.getLowerBoundPodRate()))
            caseId = 8;

        // Evaluate Price
        if (
            deltaB > 0 ||
            (deltaB == 0 && podRate.lessThanOrEqualTo(C.getOptimalPodRate()))
        ) caseId += 4;

        // Evaluate Delta Soil Demand
        if (deltaPodDemand.greaterThanOrEqualTo(C.getUpperBoundDPD()))
            caseId += 2;
        else if (deltaPodDemand.greaterThanOrEqualTo(C.getLowerBoundDPD()))
            caseId += 1;

        s.w.lastDSoil = uint128(dsoil);

        changeWeather(caseId);
        handleRain(caseId);
    }

    function changeWeather(uint256 caseId) private {
        int8 change = s.cases[caseId];
        if (change < 0) {
            if (maxYield() <= (uint32(-change))) {
                // if (change < 0 && maxYield() <= uint32(-change)),
                // then 0 <= maxYield() <= type(int8).max because change is an int8.
                // Thus, downcasting maxYield() to an int8 will not cause overflow.
                change = 1 - int8(maxYield());
                s.w.yield = 1;
            } else s.w.yield = maxYield() - (uint32(-change));
        } else s.w.yield = maxYield() + (uint32(change));

        emit WeatherChange(s.season.current, caseId, change);
    }

    function handleRain(uint256 caseId) internal {
        if (caseId < 4 || caseId > 7) {
            if (s.season.raining) s.season.raining = false;
            return;
        } else if (!s.season.raining) {
            s.season.raining = true;
            // Set the plenty per root equal to previous rain start.
            s.sops[s.season.current] = s.sops[s.season.rainStart];
            s.season.rainStart = s.season.current;
            s.r.pods = s.f.pods;
            s.r.roots = s.s.roots;
        } else if (
            s.season.current >=
            s.season.rainStart.add(s.season.withdrawSeasons - 1)
        ) {
            if (s.r.roots > 0) sop();
        }
    }

    function sop() private {
        int256 newBeans = LibBeanMetaCurve.getDeltaB();
        if (newBeans <= 0) return;
        uint256 sopBeans = uint256(newBeans);

        uint256 newHarvestable;
        if (s.f.harvestable < s.r.pods) {
            newHarvestable = s.r.pods - s.f.harvestable;
            s.f.harvestable = s.f.harvestable.add(newHarvestable);
            C.bean().mint(address(this), newHarvestable.add(sopBeans));
        } else C.bean().mint(address(this), sopBeans);
        uint256 amountOut = C.curveMetapool().exchange(0, 1, sopBeans, 0);
        rewardSop(amountOut);
        emit SeasonOfPlenty(s.season.current, amountOut, newHarvestable);
    }

    function rewardSop(uint256 amount) private {
        s.sops[s.season.rainStart] = s.sops[s.season.lastSop].add(
            amount.mul(C.getSopPrecision()).div(s.r.roots)
        );
        s.season.lastSop = s.season.rainStart;
        s.season.lastSopSeason = s.season.current;
    }
}
