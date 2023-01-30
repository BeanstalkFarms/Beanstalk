/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "../interfaces/IBean.sol";
import "./LibAppStorage.sol";
import "./LibSafeMath32.sol";
import "./LibSafeMath128.sol";
import "./LibPRBMath.sol";



/**
 * @author Publius, Brean
 * @title Dibbler
 **/
library LibDibbler {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    // Morning Auction scales temperature by 1e6
    // 1e6 = 1%
    // (6674 * 279415312704)/1e6 ~= 1864e6 = 1864%?
    uint256 private constant TEMPERATURE_SCALE = 1e6;
    uint256 private constant PRECISION = 1e8;
    
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    //////////////////// SOW ////////////////////

    /**
     * @param amount The number of Beans to Sow
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
     * 
     * 
     */
    function sow(uint256 amount, uint256 _yield, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        
        uint256 pods;
        uint256 maxYield = uint256(s.w.yield).mul(1e6);
        if (s.season.abovePeg) {
            // amount sown is rounded up, because 
            // 1: yield is rounded down.
            // 2: pods are rounded down.
            amount = scaleSoilDown(
                amount,
                _yield,
                maxYield
            );
            pods = beansToPods(
                amount,
                maxYield
            );
        } else {
            pods = beansToPods(
                amount,
                _yield
            );
        }
        (,s.f.soil) = s.f.soil.trySub(uint128(amount));

        return sowNoSoil(amount, pods, account);
    }

    /**
     * @dev Sow plot, increment pods, update sow time.
     */
    function sowNoSoil(uint256 amount, uint256 pods, address account)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }
    function sowPlot(
        address account,
        uint256 beans,
        uint256 pods
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;
        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }

    //////////////////// YIELD ////////////////////

    /// @dev Returns the temperature `s.f.yield` scaled down based on the block delta.
    /// Precision level 1e6, as soil has 1e6 precision (1% = 1e6)
    /// the formula log2(A * MAX_BLOCK_ELAPSED + 1) is applied, where
    /// A = 2;
    /// MAX_BLOCK_ELAPSED = 25;
    function yield() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 delta = block.number.sub(s.season.sunriseBlock);
        if (delta > 24) { // check most likely case first
            return uint256(s.w.yield).mul(TEMPERATURE_SCALE);
        }

        // Binary Search
        if (delta < 13) {
            if (delta < 7) { 
                if (delta < 4) {
                    if (delta < 2) {
                        if (delta < 1) {
                            return TEMPERATURE_SCALE; // delta == 0, same block as sunrise
                        }
                        else return scaleYield(279415312704); // delta == 1
                    }
                    if (delta == 2) {
                       return scaleYield(409336034395); // delta == 2
                    }
                    else return scaleYield(494912626048); // delta == 3
                }
                if (delta < 6) {
                    if (delta == 4) {
                        return scaleYield(558830625409);
                    }
                    else { // delta == 5
                        return scaleYield(609868162219);
                    }
                }
                else return scaleYield(652355825780); // delta == 6
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
                else return scaleYield(748873234524); // delta == 9
            }
            if (delta < 12) {
                if (delta == 10) {
                    return scaleYield(774327938752);
                }
                else{ // delta == 11
                    return scaleYield(797465225780); 
                }
            }
            else return scaleYield(818672068791); //delta == 12
        } 
        if (delta < 19){
            if (delta < 16) {
                if (delta < 15) {
                    if (delta == 13) {
                        return scaleYield(838245938114); 
                    }
                    else{ // delta == 14
                        return scaleYield(856420437864);
                    }
                }
                else return scaleYield(873382373802); //delta == 15
            }
            if (delta < 18) {
                if (delta == 16) {
                    return scaleYield(889283474924);
                }
                else{ // delta == 17
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
                else{ // delta == 20
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
        else {
            return scaleYield(989825252096);
        }
    }

    /// @dev scales down temperature, minimum 1e6 (unless temperature is 0%)
    /// 1e6 = 1% temperature
    function scaleYield(uint256 a) private view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 _yield  = s.w.yield;
        if(_yield == 0) return 0; 
        // provides a floor of TEMPERATURE_SCALE
        return LibPRBMath.max(
            _yield.mulDiv(
                a, 
                1e6,
                LibPRBMath.Rounding.Up
                ),
            TEMPERATURE_SCALE
        );
    }

    /**
     * @param amount The number of Beans to convert to Pods.
     * @param _yield The current temperature, measured to 1e8. 
     * @dev `pods = beans * (100e6 + _yield) / 1e8`
     */
    function beansToPods(uint256 amount, uint256 _yield)
        internal
        pure
        returns (uint256)
    {
        return amount.mulDiv(
            _yield.add(100e6),
            100e6
        );
    }

    /// @dev scales Soil Up when beanstalk is above peg. 
    // maxYield comes from s.w.yield, which has a precision 1e2 (100 = 1%)
    // yield comes from yield(), which has a precision of 1e8 (1e6 = 1%)
    // thus we need to scale maxYield up. 
    function scaleSoilUp(
        uint256 soil, 
        uint256 maxYield,
        uint256 _yield
    ) internal pure returns (uint256) {
        return soil.mulDiv(
            maxYield.add(100).mul(1e6),
            _yield.add(100e6)
        );
    }

    /// @dev scales Soil Down when beanstalk is above peg
    // when beanstalk is above peg, the soil issued changes. 
    // example - if 500 soil is issued, at temperature = 100%
    // at delta = 0, temperature = 1%, soil = 500*(100 + 100%)/(100 + 1%) = 990.09901 soil
    // if someone sow'd ~495 soil, its equilivant to sowing 250 soil at t > 25.
    // Thus when someone sows during this time, the amount subtracted from s.f.soil
    // should be scaled down. 
    function scaleSoilDown(
        uint256 soil, 
        uint256 _yield, 
        uint256 maxYield
    ) internal pure returns (uint256) {
        return soil.mulDiv(
            _yield.add(100e6),
            maxYield.add(100e6),
            LibPRBMath.Rounding.Up
        );
    }

    /// @dev peas are the potential remaining pods that can be issued within a season.
    function peas() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if(s.season.abovePeg) {
            return beansToPods(
                s.f.soil,
                uint256(s.w.yield).mul(1e6)
            );
        } else {
            return beansToPods(
                s.f.soil,
                yield()
            );
        }
    }
}
