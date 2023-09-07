// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/libraries/Decimal.sol";
import "contracts/libraries/Curve/LibBeanMetaCurve.sol";
import "contracts/libraries/LibEvaluate.sol";
// import "./CaseFacet.sol";
import "contracts/libraries/LibCases.sol";
import "./Sun.sol";

// 
/**
 * @title Weather
 * @author Publius
 * @notice Weather controls the Temperature and Grown Stalk to LP on the Farm.
 */
contract Weather is Sun {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;
    using DecimalExtended for uint256;
    using Decimal for Decimal.D256;

    // constants have the same value, but for different reasons.
    // mT and mL are divided by RELATIVE_PRECISION as they 
    // are a percentage (100% = 1e4).
    // bL is multiplied by GROWN_STALK_PRECISION as bL has a 
    // precision of 2 decimals, and needs to have 6 decimals
    // to match the precision of percentOfNewGrownStalkToLP.
    uint16 constant internal RELATIVE_PRECISION = 1e4;
    uint16 constant internal GROWN_STALK_PRECISION = 1e4;

    
    /**
     * @notice Emitted when the Temperature (fka "Weather") changes.
     * @param season The current Season
     * @param caseId The Weather case, which determines how much the Temperature is adjusted.
     * @param relChange The relative change in Temperature.
     * @param absChange The absolute change in Temperature.
     * 
     * @dev the relative change is applied before the absolute change. 
     * T_n = mT * T_n-1 + bT
     */
    event TemperatureChange(
        uint256 indexed season,
        uint256 caseId,
        uint16 relChange,
        int16 absChange
    );

    /**
     * @notice Emitted when the grownStalkToLP changes.
     * @param season The current Season
     * @param caseId The Weather case, which determines how much the Temperature is adjusted.
     * @param relChange The relative change in Temperature.
     * @param absChange The absolute change in Temperature.
     * 
     * @dev the relative change is applied before the absolute change. 
     * L_n = mL * L_n-1 + bL
     */
    event GrownStalkToLPChange(
        uint256 indexed season,
        uint256 caseId,
        uint16 relChange,
        int16 absChange
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

    //////////////////// WEATHER INTERNAL ////////////////////

    /**
     * @notice from deltaB, podRate, change in soil demand, and liquidity to supply ratio,
     * calculate the caseId, and update the temperature and grownStalkPerBDVToLP. 
     * @param deltaB Pre-calculated deltaB from {Oracle.stepOracle}.
     * @dev A detailed explanation of the temperature and grownStalkPerBDVToLP
     * mechanism can be found in the Beanstalk whitepaper. 
     * An explanation of state variables can be found in {AppStorage}.
     */
    function calcCaseIdandUpdate(int256 deltaB) internal returns (uint256 caseId) {
        uint256 beanSupply = C.bean().totalSupply();
        // Prevent infinite pod rate
        if (beanSupply == 0) {
            s.w.t = 1;
            return 8; // Reasonably low
        }

        // Calculate Delta Soil Demand
        uint256 dsoil = s.f.beanSown;
        s.f.beanSown = 0;

        Decimal.D256 memory deltaPodDemand;
        (deltaPodDemand, s.w.lastSowTime, s.w.thisSowTime) = LibEvaluate.calcDeltaPodDemand(dsoil);

        // Calculate Lp To Supply Ratio
        Decimal.D256 memory lpToSupplyRatio = LibEvaluate.calcLPToSupplyRatio(beanSupply);

        caseId = LibEvaluate.evaluateBeanstalk(
            deltaB, // deltaB
            Decimal.ratio(s.f.pods.sub(s.f.harvestable), beanSupply), // Pod Rate
            deltaPodDemand, // change in soil demand
            lpToSupplyRatio // lp to Supply Ratio
        );

        s.w.lastDSoil = uint128(dsoil); // SafeCast not necessary as `s.f.beanSown` is uint128.
        (uint16 mT, int16 bT, uint16 mL, int16 bL) = LibCases.decodeCaseData(caseId);
        changeTemperature(mT, bT, caseId);
        changeNewGrownStalkPerBDVtoLP(mL, bL, caseId);
        handleRain(caseId);
    }

    /**
     * @dev Changes the current Temperature `s.w.t` based on the Case Id.
     */
    function changeTemperature(uint16 mT, int16 bT, uint256 caseId) private {
        uint32 t = s.w.t;

        if (bT < 0) {
            if (t <= (uint32(-bT))) {
                // if (change < 0 && t <= uint32(-change)),
                // then 0 <= t <= type(int16).max because change is an int16.
                // Thus, downcasting t to an int16 will not cause overflow.
                bT = 1 - int16(t);
                s.w.t = 1;
            } else {
                s.w.t = t.mul(mT).div(RELATIVE_PRECISION) - uint32(-bT);
            }
        } else {
            s.w.t = t.mul(mT).div(RELATIVE_PRECISION) + uint32(bT);
        }

        emit TemperatureChange(s.season.current, caseId, mT, bT);
    }

    /**
     * @dev Changes the grownStalkPerBDVPerSeason ` based on the CaseId.
     */
    function changeNewGrownStalkPerBDVtoLP(uint16 mL, int16 bL, uint256 caseId) private {
        uint128 percentNewGrownStalkToLP = s.seedGauge.percentOfNewGrownStalkToLP;
        if(bL < 0){
            if(percentNewGrownStalkToLP <= uint128(-bL).mul(GROWN_STALK_PRECISION)){
                bL = 1e2 - int16(percentNewGrownStalkToLP);
                s.seedGauge.percentOfNewGrownStalkToLP = 1e6;
            } else {
                //TODO include min
                s.seedGauge.percentOfNewGrownStalkToLP = 
                    percentNewGrownStalkToLP.mul(mL).div(RELATIVE_PRECISION)
                    .add(uint128(-bL).mul(GROWN_STALK_PRECISION));
            }
        } else {
            //TODO include max
            s.seedGauge.percentOfNewGrownStalkToLP = 
                percentNewGrownStalkToLP.mul(mL).div(RELATIVE_PRECISION)
                .add(uint128(bL).mul(GROWN_STALK_PRECISION));
        }

        // TODO: check whether event is good:
        emit GrownStalkToLPChange(s.season.current, caseId, mL, bL);
    }

    /**
     * @dev Oversaturated was previously referred to as Raining and thus code
     * references mentioning Rain really refer to Oversaturation. If P > 1 and the
     * Pod Rate is less than 5%, the Farm is Oversaturated. If it is Oversaturated
     * for a Season, each Season in which it continues to be Oversaturated, it Floods.
     */
    function handleRain(uint256 caseId) internal {
        // TODO: update cases, assumes we flood irregardless of LoSR
        // cases 4-7 represent the case where the pod rate is less than 5% and P > 1.
        if (caseId.mod(32) < 4 || caseId.mod(32) > 7) {
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
        } else {
            if (s.r.roots > 0) {
                sop();
            }
        }  
    }

    /**
     * @dev Flood was previously called a "Season of Plenty" (SOP for short).
     * When Beanstalk has been Oversaturated for a Season, Beanstalk returns the
     * Bean price to its peg by minting additional Beans and selling them directly
     * on Curve. Proceeds  from the sale in the form of 3CRV are distributed to
     * Stalkholders at the beginning of a Season in proportion to their Stalk
     * ownership when the Farm became Oversaturated. Also, at the beginning of the
     * Flood, all Pods that were minted before the Farm became Oversaturated Ripen
     * and become Harvestable.
     * For more information On Oversaturation see {Weather.handleRain}.
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
            amount.mul(C.SOP_PRECISION).div(s.r.roots)
        );
        s.season.lastSop = s.season.rainStart;
        s.season.lastSopSeason = s.season.current;
    }
}
