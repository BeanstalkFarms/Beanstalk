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
    
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    /**
     * Shed
     **/

    /**
     * @param amount The number of Beans to Sow
     * @param account The account sowing Beans
     * @dev 
     * 
     * ## Above Peg 
     * 
     * | t   | pods  | soil                                | yield                         | maxYield     |
     * |-----|-------|-------------------------------------|-------------------------------|--------------|
     * | 0   | 500e6 | 495e6 (500e6 / (1+1%))              | 1e6 (1%)                      | 1250 (1250%) |
     * | 12  | 500e6 | 111.42e6 (500e6 / (1+348.75%))      | 348.75e6 (27.9% * 1250 * 1e6) | 1250         |
     * | 300 | 500e6 | 22.22e6 (500e6 / (1+1250%))         | 1250e6                        | 1250         |
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
     */
    function sow(uint256 amount, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // the amount of soil changes as a function of the morning auction;
        // soil consumed increases as dutch auction passes
        uint256 pods;

        if (s.season.abovePeg) {
            // t = 0   -> tons of soil
            // t = 300 -> however much soil to get fixed number of pods at current temperature
            //         -> scaledSoil = soil
            uint256 scaledSoil = amount.mulDiv(
                yield().add(1e8), 
                1e8,
                LibPRBMath.Rounding.Up
            );

            pods = beansToPodsAbovePeg(amount, s.f.soil);

            // Overflow can occur due to rounding up, 
            // but only occurs when all remaining soil is sown.
            (, s.f.soil) = s.f.soil.trySub(uint128(scaledSoil)); 
        } else {
            pods = beansToPods(amount, s.w.yield);

            // We can assume amount <= soil from getSowAmount when below peg
            s.f.soil = s.f.soil - uint128(amount); 
        }

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
        // minimum temperature is applied by DECIMALS
        return LibPRBMath.max(_yield.mulDiv(a, 1e6), TEMPERATURE_SCALE);
    }

    /**
     * 
     */
    function beansToPodsAbovePeg(uint256 beans, uint256 maxPeas) 
        internal 
        view
        returns (uint256) 
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // All soil is sown, pods issued must equal peas.
        if(s.f.soil == 0){ 
            return maxPeas;
        } 

        // We round up as Beanstalk would rather issue too much pods than not enough.
        else {
            return beans.add(
                beans.mulDiv(
                    yield(),
                    1e8,
                    LibPRBMath.Rounding.Up
                )
            );
        }
    }

    /// @dev beans * (1 + (weather / 1e2))
    function beansToPods(uint256 beans, uint256 weather)
        internal
        pure
        returns (uint256)
    {
        return beans.add(beans.mul(weather).div(100));
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
}
