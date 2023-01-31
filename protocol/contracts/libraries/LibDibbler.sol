/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {C} from "../C.sol";
import {IBean} from "../interfaces/IBean.sol";
import {LibAppStorage} from "./LibAppStorage.sol";
import {LibSafeMath32} from "./LibSafeMath32.sol";
import {LibSafeMath128} from "./LibSafeMath128.sol";
import {LibPRBMath} from "./LibPRBMath.sol";
import {AppStorage} from "~/beanstalk/AppStorage.sol";

/**
 * @title Dibbler
 * @author Publius, Brean
 */
library LibDibbler {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    // Morning Auction scales temperature by 1e6
    // 1e6 = 1%
    // (6674 * 0.279415312704e12)/1e6 ~= 1864e6 = 1864%?
    // 1e6 = 1% = 0.01
    uint256 constant YIELD_PRECISION = 1e6; 
    uint256 constant ONE_HUNDRED_PCT = 100 * YIELD_PRECISION;
    
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    //////////////////// SOW ////////////////////

    /**
     * @param beans The number of Beans to Sow
     * @param morningYield FIXME
     * @param account The account sowing Beans
     * @dev 
     * 
     * ## Above Peg 
     * 
     * | t   | pods  | soil                                 | yield                          | maxYield     |
     * |-----|-------|--------------------------------------|--------------------------------|--------------|
     * | 0   | 500e6 | ~6683e6 (500e6 *(1 + 1250%)/(1+1%))  | 1e6 (1%)                       | 1250 (1250%) |
     * | 12  | 500e6 | ~1507e6 (500e6 *(1 + 1250%)/(1+348%))| 348.75e6 (27.9% * 1250 * 1e6)  | 1250         |
     * | 300 | 500e6 |  500e6 (500e6 *(1 + 1250%)/(1+1250%))| 1250e6                         | 1250         |
     * 
     * ## Below Peg
     * 
     * | t   | pods                            | soil  | yield                         | maxYield     |
     * |-----|---------------------------------|-------|-------------------------------|--------------|
     * | 0   | 505e6 (500e6 * (1+1%))          | 500e6 | 1e6 (1%)                      | 1250 (1250%) |
     * | 12  | 2243.75e6 (500e6 * (1+348.75%)) | 500e6 | 348.75e6 (27.9% * 1250 * 1e6) | 1250         |
     * | 300 | 6750e6 (500e6 * (1+1250%))      | 500e6 | 1250e6                        | 1250         |
     * 
     * Yield is floored at 1%.
     * the amount of soil changes as a function of the morning auction;
     * soil consumed increases as dutch auction passes
     * t = 0   -> tons of soil
     * t = 300 -> however much soil to get fixed number of pods at current temperature
     * soil subtracted is thus scaled down:
     * soilSubtracted = s.f.soil * SoilSowed/totalSoilAbovePeg
     * soilSubtracted = s.f.soil * SoilSowed/(s.f.soil * ((1 + s.w.yield) /(1 + yield())))
     * soilSubtracted = Amt * (1 + yield())/(1+ s.w.yield) 
     * soilSubtracted = pods/(1+ s.w.yield) 
     */
    function sow(uint256 beans, uint256 morningYield, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        uint256 pods;
        uint256 maxYield = uint256(s.w.yield).mul(YIELD_PRECISION);

        // Above peg: FIXME
        if (s.season.abovePeg) {
            // amount sown is rounded up, because 
            // 1: yield is rounded down.
            // 2: pods are rounded down.
            beans = scaleSoilDown(
                beans,
                morningYield,
                maxYield
            );
            pods = beansToPods(
                beans,
                maxYield
            );
        } 
        
        // Below peg: FIXME
        else {
            pods = beansToPods(
                beans,
                morningYield
            );
        }

        (, s.f.soil) = s.f.soil.trySub(uint128(beans));

        return sowNoSoil(account, beans, pods);
    }

    /**
     * @dev Sows a new Plot, increments total Pods, updates Sow time.
     */
    function sowNoSoil(address account, uint256 beans, uint256 pods)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        sowPlot(account, beans, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();

        return pods;
    }

    /**
     * @dev 
     */
    function sowPlot(address account, uint256 beans, uint256 pods) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    /** 
     * @dev Stores the time elapsed from the start of the Season to the first
     * Sow of the season, or if all but 1 Soil is Sown.
     * 
     * Rationale: Beanstalk utilize the time in which Soil was Sown to gauge
     * demand for Soil, which affects how the Temperature is adjusted. If all 
     * Soil is Sown in 1 second vs. 1 hour, Beanstalk assumes that the former
     * shows more demand than the latter.
     *
     * `nextSowTime` represents the target time of the first Sow for the *next*
     * Season to be considered increasing in demand.
     * 
     * If there more than 1 Soil still available, or `nextSowTime` is less than 
     * type(uint32).max, do nothing.
     * 
     * Otherwise, set `nextSowTime` to be the difference between the Season
     * start timestamp and the current block timestamp.
     * 
     * `nextSowTime` is therefore only updated when:
     *  - After this Sow, there is less than 1 Soil available
     *  - `nextSowTime` has not been updated this Season; it is reset to
     *    type(uint32).max during {sunrise}.
     * 
     * Note that `s.f.soil` was decremented in the upstream {sow} function.
     */
    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // 1e6 = 1 Soil
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;

        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }

    //////////////////// YIELD ////////////////////
    
    /**
     * @dev Returns the temperature `s.f.yield` scaled down based on the block delta.
     * Precision level 1e6, as soil has 1e6 precision (1% = 1e6)
     * the formula `log2(A * MAX_BLOCK_ELAPSED + 1)` is applied, where:
     * `A = 2`
     * `MAX_BLOCK_ELAPSED = 25`
     */
    function morningYield() internal view returns (uint256 morningYield) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 delta = block.number.sub(s.season.sunriseBlock);

        // check most likely case first
        if (delta > 24) {
            return uint256(s.w.yield).mul(YIELD_PRECISION);
        }

        // Binary Search
        if (delta < 13) {
            if (delta < 7) { 
                if (delta < 4) {
                    if (delta < 2) {
                        // delta == 0, same block as sunrise
                        if (delta < 1) {
                            return YIELD_PRECISION;
                        }
                        // delta == 1
                        else {
                            return scaleYield(279415312704);
                        }
                    }
                    if (delta == 2) {
                       return scaleYield(409336034395);
                    }
                    else { // delta == 3
                        return scaleYield(494912626048);
                    }
                }
                if (delta < 6) {
                    if (delta == 4) {
                        return scaleYield(558830625409);
                    }
                    else { // delta == 5
                        return scaleYield(609868162219);
                    }
                }
                else { // delta == 6
                    return scaleYield(652355825780); 
                }
            }
            if (delta < 10) {
                if (delta < 9) {
                    if (delta == 7) {
                        return scaleYield(688751347100);
                    }
                    else { // delta == 8
                        return scaleYield(720584687295);
                    }
                }
                else { // delta == 9
                    return scaleYield(748873234524); 
                }
            }
            if (delta < 12) {
                if (delta == 10) {
                    return scaleYield(774327938752);
                }
                else { // delta == 11
                    return scaleYield(797465225780); 
                }
            }
            else { // delta == 12
                return scaleYield(818672068791); 
            }
        } 
        if (delta < 19){
            if (delta < 16) {
                if (delta < 15) {
                    if (delta == 13) {
                        return scaleYield(838245938114); 
                    }
                    else { // delta == 14
                        return scaleYield(856420437864);
                    }
                }
                else { // delta == 15
                    return scaleYield(873382373802);
                }
            }
            if (delta < 18) {
                if (delta == 16) {
                    return scaleYield(889283474924);
                }
                else { // delta == 17
                    return scaleYield(904248660443);
                }
            }
            return scaleYield(918382006208); // delta == 18
        }
        if (delta < 22) {
            if (delta < 21) {
                if (delta == 19) {
                    return scaleYield(931771138485); 
                }
                else { // delta == 20
                    return scaleYield(944490527707);
                }
            }
            return scaleYield(956603996980); // delta == 21
        }
        if (delta <= 23){ 
            if (delta == 22) {
                return scaleYield(968166659804);
            }
            else { // delta == 23
                return scaleYield(979226436102);
            }
        }
        else { // delta == 24
            return scaleYield(989825252096);
        }
    }

    /**
     * @param pct The percentage to scale down by, measured to 1e12.
     * @return scaledYield The scaled yield, measured to 1e8 = 100e6 = 100% = 1.
     * @dev Scales down temperature, minimum 1e6 (unless temperature is 0%)
     * 1e6 = 1% temperature
     *
     * 279415312704 = 0.279415312704e12
     * 
     * `s.f.yield = 6674 => 6674% = 66.74 `
     * 
     * FIXME: think on how to explain decimals
     */
    function scaleYield(uint256 pct) private view returns (uint256 scaledYield) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 maxYield = s.w.yield;
        if(maxYield == 0) return 0; 

        return LibPRBMath.max(
            // To save gas, `pct` is pre-calculated to 12 digits. Here we
            // perform the following transformation:
            // (1e2)    maxYield                100%
            // (1e12)    * pct 
            // (1e6)     / YIELD_PRECISION      1%
            // (1e8)     = scaledYield 
            maxYield.mulDiv(
                pct, 
                YIELD_PRECISION,
                LibPRBMath.Rounding.Up
            ),
            // Floor at YIELD_PRECISION (1%)
            YIELD_PRECISION
        );
    }

    /**
     * @param beans The number of Beans to convert to Pods.
     * @param _yield The current yield, measured to 1e8. 
     * @dev Converts Beans to Pods based on `_yield`.
     * 
     * `pods = beans * (100e6 + _yield) / 100e6`
     * `pods = beans * (1 + _yield / 100e6)`
     *
     * Beans and Pods are measured to 6 decimals.
     */
    function beansToPods(uint256 beans, uint256 _yield)
        internal
        pure
        returns (uint256 pods)
    {
        return beans.mulDiv(
            _yield.add(ONE_HUNDRED_PCT),
            ONE_HUNDRED_PCT
        );
    }

    /**
     * @dev Scales Soil up when Beanstalk is above peg.
     * maxYield comes from s.w.yield, which has a precision 1e2 (100 = 1%)
     * yield comes from yield(), which has a precision of 1e8 (1e6 = 1%)
     * thus we need to scale maxYield up.
     * 
     * Scaling up -> round down
     * Scaling down -> round up
     * 
     * (1 + maxYield) / (1 + morningYield)
     */
    function scaleSoilUp(
        uint256 soil, 
        uint256 maxYield,
        uint256 morningYield
    ) internal pure returns (uint256) {
        return soil.mulDiv(
            maxYield.add(ONE_HUNDRED_PCT),
            morningYield.add(ONE_HUNDRED_PCT)
        );
    }
    
    /**
     * @dev Scales Soil down when Beanstalk is above peg.
     * 
     * When Beanstalk is above peg, the Soil issued changes. Example:
     * 
     * If 500 Spoil is issued when `s.f.yield = 100e2 = 100%`
     * At delta = 0: yield() = 1%, Soil = 500*(100 + 100%)/(100 + 1%) = 990.09901 soil
     *
     * If someone sow'd ~495 soil, it's equilivant to sowing 250 soil at t > 25.
     * Thus when someone sows during this time, the amount subtracted from s.f.soil
     * should be scaled down.
     * 
     * Note: param ordering matches the mulDiv operation
     */
    function scaleSoilDown(
        uint256 soil, 
        uint256 morningYield, 
        uint256 maxYield
    ) internal pure returns (uint256) {
        return soil.mulDiv(
            morningYield.add(ONE_HUNDRED_PCT),
            maxYield.add(ONE_HUNDRED_PCT),
            LibPRBMath.Rounding.Up
        );
    }

    /**
     * @dev Peas are the potential remaining Pods that can be issued within a Season.
     */
    function peas() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Above peg: number of Pods is fixed based on `s.w.yield`, Soil adjusts
        if(s.season.abovePeg) {
            return beansToPods(
                s.f.soil, // 1 bean = 1 soil
                uint256(s.w.yield).mul(YIELD_PRECISION) // 1e2 -> 1e8
            );
        } 
        
        // Below peg: amount of Soil is fixed, yield adjusts
        else {
            return beansToPods(
                s.f.soil, // 1 bean = 1 soil
                morningYield()
            );
        }
    }
}
