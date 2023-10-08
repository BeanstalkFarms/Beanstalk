// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibBeanMetaCurve} from "contracts/libraries/Curve/LibBeanMetaCurve.sol";
import {LibEvaluate, Decimal, DecimalExtended} from "contracts/libraries/LibEvaluate.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {Sun, SafeMath, C} from "./Sun.sol";

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

    uint128 internal constant RATIO_PRECISION = 100e18;
    uint32 internal constant TEMP_PRECISION = 100e6;

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
        uint32 relChange,
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
    event BeanToMaxLpGpPerBDVRatioChange(
        uint256 indexed season,
        uint256 caseId,
        uint80 relChange,
        int80 absChange
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
        // prevents infinite L2SR and podrate
        if (beanSupply == 0) {
            s.w.t = 1;
            return 9; // Reasonably low
        }
        // Calculate Case Id
        caseId = LibEvaluate.evaluateBeanstalk(deltaB, beanSupply);
        updateTemperatureAndBeanToMaxLPRatio(caseId);
        handleRain(caseId);
    }

    function updateTemperatureAndBeanToMaxLPRatio(uint256 caseId) internal {
        LibCases.CaseData memory cd = LibCases.decodeCaseData(caseId);
        updateTemperature(cd.mT, cd.bT, caseId);
        updateBeanToMaxLPRatio(cd.mL, cd.bL, caseId);
    }

    /**
     * @dev Changes the current Temperature `s.w.t` based on the Case Id.
     */
    function updateTemperature(uint32 mT, int16 bT, uint256 caseId) private {
        uint256 t = s.w.t;
        t = t.mul(mT).div(TEMP_PRECISION);
        if (bT < 0) {
            if (t <= uint256(-bT)) {
                // if (change < 0 && t <= uint32(-change)),
                // then 0 <= t <= type(int16).max because change is an int16.
                // Thus, downcasting t to an int16 will not cause overflow.
                bT = 1 - int16(t);
                s.w.t = 1;
            } else {
                s.w.t = uint32(t - uint256(-bT));
            }
        } else {
            s.w.t = uint32(t + uint256(bT));
        }

        emit TemperatureChange(s.season.current, caseId, mT, bT);
    }

    /**
     * @notice Changes the grownStalkPerBDVPerSeason ` based on the CaseId.
     * 
     * @dev mL and bL are set during edge cases such that the event emitted is valid.
     */
    function updateBeanToMaxLPRatio(uint80 mL, int80 bL, uint256 caseId) private {
        uint256 beanToMaxLpGpPerBDVRatio = s.seedGauge.beanToMaxLpGpPerBDVRatio;
        beanToMaxLpGpPerBDVRatio = beanToMaxLpGpPerBDVRatio.mul(mL).div(RATIO_PRECISION);
        if (beanToMaxLpGpPerBDVRatio >= 100e18) {
            bL = int80(uint256(100e18).sub(s.seedGauge.beanToMaxLpGpPerBDVRatio));
            mL = 100e18;
            s.seedGauge.beanToMaxLpGpPerBDVRatio = 100e18;
        } else if (beanToMaxLpGpPerBDVRatio <= 0.01e18) {
            // if the beanToMaxLpGpPerBDVRatio gets less than 0.01%, set it to 0% instead. 
            bL = int80(s.seedGauge.beanToMaxLpGpPerBDVRatio);
            mL = 100e18;
            s.seedGauge.beanToMaxLpGpPerBDVRatio = 0;
        } else {
            if (bL < 0) {
                if (beanToMaxLpGpPerBDVRatio <= uint128(-bL)) {
                    bL = -int80(beanToMaxLpGpPerBDVRatio);
                    s.seedGauge.beanToMaxLpGpPerBDVRatio = 0;
                } else {
                    s.seedGauge.beanToMaxLpGpPerBDVRatio = uint128(
                        beanToMaxLpGpPerBDVRatio.sub(uint128(-bL))
                    );
                }
            } else {
                if (beanToMaxLpGpPerBDVRatio.add(uint128(bL)) >= 100e18) {
                    // if (change > 0 && 100e18 - beanToMaxLpGpPerBDVRatio <= bL),
                    // then bL cannot overflow.
                    bL = int80(uint256(100e18).sub(beanToMaxLpGpPerBDVRatio));
                    s.seedGauge.beanToMaxLpGpPerBDVRatio = 100e18;
                } else {
                    s.seedGauge.beanToMaxLpGpPerBDVRatio = uint128(
                        beanToMaxLpGpPerBDVRatio.add(uint128(bL))
                    );
                }
            }
        }

        emit BeanToMaxLpGpPerBDVRatioChange(s.season.current, caseId, mL, bL);
    }

    /**
     * @dev Oversaturated was previously referred to as Raining and thus code
     * references mentioning Rain really refer to Oversaturation. If P > 1 and the
     * Pod Rate is less than 5%, the Farm is Oversaturated. If it is Oversaturated
     * for a Season, each Season in which it continues to be Oversaturated, it Floods.
     */
    function handleRain(uint256 caseId) internal {
        // cases 3-8 represent the case where the pod rate is less than 5% and P > 1.
        if (caseId.mod(36) < 3 || caseId.mod(36) > 8) {
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
