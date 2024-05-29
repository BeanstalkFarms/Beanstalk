// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../C.sol";

/**
 * @title LibIncentive
 * @author Publius, Chaikitty, Brean
 * @notice Calculates the reward offered for calling Sunrise, adjusts for current gas & ETH prices,
 * and scales the reward up when the Sunrise is called late.
 */
library LibIncentive {
    using LibRedundantMath256 for uint256;

    /**
     * @notice Emitted when Beanstalk pays `beans` to `account` as a reward for calling `sunrise()`.
     * @param account The address to which the reward Beans were sent
     * @param beans The amount of Beans paid as a reward
     */
    event Incentivization(address indexed account, uint256 beans);

    /// @dev The Sunrise reward reaches its maximum after this many seconds elapse.
    uint256 internal constant MAX_SECONDS_LATE = 300;

    /// @dev Base BEAN reward to cover cost of operating a bot.
    uint256 internal constant BASE_REWARD = 5e6; // 5 BEAN

    /// @dev `sunriseReward` is precomputed in {fracExp} using this precision.
    uint256 private constant FRAC_EXP_PRECISION = 1e6;

    //////////////////// CALCULATE REWARD ////////////////////

    /**
     * @param secondsLate The number of blocks late that {sunrise()} was called.
     * @dev Calculates Sunrise incentive amount based on current gas prices and a computed
     * BEAN:ETH price. This function is called at the end of {sunriseTo()} after all
     * "step" functions have been executed.
     */
    function determineReward(uint256 secondsLate) external pure returns (uint256) {
        // Cap the maximum number of blocks late. If the sunrise is later than
        // this, Beanstalk will pay the same amount. Prevents unbounded return value.
        if (secondsLate > MAX_SECONDS_LATE) {
            secondsLate = MAX_SECONDS_LATE;
        }

        // Scale the reward up as the number of blocks after expected sunrise increases.
        // `sunriseReward * (1 + 1/100)^(blocks late * seconds per block)`
        // NOTE: 1.01^(25 * 12) = 19.78, This is the maximum multiplier.
        return fracExp(BASE_REWARD, secondsLate);
    }

    //////////////////// MATH UTILITIES ////////////////////

    /**
     * @dev fraxExp scales up the bean reward based on the blocks late.
     * the formula is beans * (1.01)^(Blocks Late * 12 second block time).
     * since block time is capped at 25 blocks,
     * we only need to check cases 0 - 25
     */
    function fracExp(
        uint256 beans,
        uint256 secondsLate
    ) internal pure returns (uint256 scaledSunriseReward) {
        // check most likely case first
        if (secondsLate == 0) {
            return beans;
        }

        // use an if ladder to determine the scaling factor. If ladder is used over binary search
        // due to simplicity. Checked every 2 seconds to reduce bytecode size. SecondsLate is rounded up given that beanstalk would rather incentivize slightly more to call sunrise earlier than to incentivize slightly less for a later sunrise.
        // repeat until 300 seconds:
        if (secondsLate <= 30) {
            if (secondsLate == 0) {
                return _scaleReward(beans, 1_000_000);
            }
            if (secondsLate <= 2) {
                return _scaleReward(beans, 1_020_100);
            }
            if (secondsLate <= 4) {
                return _scaleReward(beans, 1_040_604);
            }
            if (secondsLate <= 6) {
                return _scaleReward(beans, 1_061_520);
            }
            if (secondsLate <= 8) {
                return _scaleReward(beans, 1_082_857);
            }
            if (secondsLate <= 10) {
                return _scaleReward(beans, 1_104_622);
            }
            if (secondsLate <= 12) {
                return _scaleReward(beans, 1_126_825);
            }
            if (secondsLate <= 14) {
                return _scaleReward(beans, 1_149_474);
            }
            if (secondsLate <= 16) {
                return _scaleReward(beans, 1_172_579);
            }
            if (secondsLate <= 18) {
                return _scaleReward(beans, 1_196_147);
            }
            if (secondsLate <= 20) {
                return _scaleReward(beans, 1_220_190);
            }
            if (secondsLate <= 22) {
                return _scaleReward(beans, 1_244_716);
            }
            if (secondsLate <= 24) {
                return _scaleReward(beans, 1_269_735);
            }
            if (secondsLate <= 26) {
                return _scaleReward(beans, 1_295_256);
            }
            if (secondsLate <= 28) {
                return _scaleReward(beans, 1_321_291);
            }
            if (secondsLate <= 30) {
                return _scaleReward(beans, 1_347_849);
            }
        } else if (secondsLate <= 60) {
            if (secondsLate <= 32) {
                return _scaleReward(beans, 1_374_941);
            }
            if (secondsLate <= 34) {
                return _scaleReward(beans, 1_402_577);
            }
            if (secondsLate <= 36) {
                return _scaleReward(beans, 1_430_769);
            }
            if (secondsLate <= 38) {
                return _scaleReward(beans, 1_459_527);
            }
            if (secondsLate <= 40) {
                return _scaleReward(beans, 1_488_864);
            }
            if (secondsLate <= 42) {
                return _scaleReward(beans, 1_518_790);
            }
            if (secondsLate <= 44) {
                return _scaleReward(beans, 1_549_318);
            }
            if (secondsLate <= 46) {
                return _scaleReward(beans, 1_580_459);
            }
            if (secondsLate <= 48) {
                return _scaleReward(beans, 1_612_226);
            }
            if (secondsLate <= 50) {
                return _scaleReward(beans, 1_644_632);
            }
            if (secondsLate <= 52) {
                return _scaleReward(beans, 1_677_689);
            }
            if (secondsLate <= 54) {
                return _scaleReward(beans, 1_711_410);
            }
            if (secondsLate <= 56) {
                return _scaleReward(beans, 1_745_810);
            }
            if (secondsLate <= 58) {
                return _scaleReward(beans, 1_780_901);
            }
            if (secondsLate <= 60) {
                return _scaleReward(beans, 1_816_697);
            }
        } else if (secondsLate <= 90) {
            if (secondsLate <= 62) {
                return _scaleReward(beans, 1_853_212);
            }
            if (secondsLate <= 64) {
                return _scaleReward(beans, 1_890_462);
            }
            if (secondsLate <= 66) {
                return _scaleReward(beans, 1_928_460);
            }
            if (secondsLate <= 68) {
                return _scaleReward(beans, 1_967_222);
            }
            if (secondsLate <= 70) {
                return _scaleReward(beans, 2_006_763);
            }
            if (secondsLate <= 72) {
                return _scaleReward(beans, 2_047_099);
            }
            if (secondsLate <= 74) {
                return _scaleReward(beans, 2_088_246);
            }
            if (secondsLate <= 76) {
                return _scaleReward(beans, 2_130_220);
            }
            if (secondsLate <= 78) {
                return _scaleReward(beans, 2_173_037);
            }
            if (secondsLate <= 80) {
                return _scaleReward(beans, 2_216_715);
            }
            if (secondsLate <= 82) {
                return _scaleReward(beans, 2_261_271);
            }
            if (secondsLate <= 84) {
                return _scaleReward(beans, 2_306_723);
            }
            if (secondsLate <= 86) {
                return _scaleReward(beans, 2_353_088);
            }
            if (secondsLate <= 88) {
                return _scaleReward(beans, 2_400_385);
            }
            if (secondsLate <= 90) {
                return _scaleReward(beans, 2_448_633);
            }
        } else if (secondsLate <= 120) {
            if (secondsLate <= 92) {
                return _scaleReward(beans, 2_497_850);
            }
            if (secondsLate <= 94) {
                return _scaleReward(beans, 2_548_057);
            }
            if (secondsLate <= 96) {
                return _scaleReward(beans, 2_599_273);
            }
            if (secondsLate <= 98) {
                return _scaleReward(beans, 2_651_518);
            }
            if (secondsLate <= 100) {
                return _scaleReward(beans, 2_704_814);
            }
            if (secondsLate <= 102) {
                return _scaleReward(beans, 2_759_181);
            }
            if (secondsLate <= 104) {
                return _scaleReward(beans, 2_814_640);
            }
            if (secondsLate <= 106) {
                return _scaleReward(beans, 2_871_214);
            }
            if (secondsLate <= 108) {
                return _scaleReward(beans, 2_928_926);
            }
            if (secondsLate <= 110) {
                return _scaleReward(beans, 2_987_797);
            }
            if (secondsLate <= 112) {
                return _scaleReward(beans, 3_047_852);
            }
            if (secondsLate <= 114) {
                return _scaleReward(beans, 3_109_114);
            }
            if (secondsLate <= 116) {
                return _scaleReward(beans, 3_171_607);
            }
            if (secondsLate <= 118) {
                return _scaleReward(beans, 3_235_356);
            }
            if (secondsLate <= 120) {
                return _scaleReward(beans, 3_300_387);
            }
        } else if (secondsLate <= 150) {
            if (secondsLate <= 122) {
                return _scaleReward(beans, 3_366_725);
            }
            if (secondsLate <= 124) {
                return _scaleReward(beans, 3_434_396);
            }
            if (secondsLate <= 126) {
                return _scaleReward(beans, 3_503_427);
            }
            if (secondsLate <= 128) {
                return _scaleReward(beans, 3_573_846);
            }
            if (secondsLate <= 130) {
                return _scaleReward(beans, 3_645_680);
            }
            if (secondsLate <= 132) {
                return _scaleReward(beans, 3_718_959);
            }
            if (secondsLate <= 134) {
                return _scaleReward(beans, 3_793_710);
            }
            if (secondsLate <= 136) {
                return _scaleReward(beans, 3_869_963);
            }
            if (secondsLate <= 138) {
                return _scaleReward(beans, 3_947_749);
            }
            if (secondsLate <= 140) {
                return _scaleReward(beans, 4_027_099);
            }
            if (secondsLate <= 142) {
                return _scaleReward(beans, 4_108_044);
            }
            if (secondsLate <= 144) {
                return _scaleReward(beans, 4_190_616);
            }
            if (secondsLate <= 146) {
                return _scaleReward(beans, 4_274_847);
            }
            if (secondsLate <= 148) {
                return _scaleReward(beans, 4_360_771);
            }
            if (secondsLate <= 150) {
                return _scaleReward(beans, 4_448_423);
            }
        } else if (secondsLate <= 180) {
            if (secondsLate <= 152) {
                return _scaleReward(beans, 4_537_836);
            }
            if (secondsLate <= 154) {
                return _scaleReward(beans, 4_629_047);
            }
            if (secondsLate <= 156) {
                return _scaleReward(beans, 4_722_091);
            }
            if (secondsLate <= 158) {
                return _scaleReward(beans, 4_817_005);
            }
            if (secondsLate <= 160) {
                return _scaleReward(beans, 4_913_826);
            }
            if (secondsLate <= 162) {
                return _scaleReward(beans, 5_012_594);
            }
            if (secondsLate <= 164) {
                return _scaleReward(beans, 5_113_347);
            }
            if (secondsLate <= 166) {
                return _scaleReward(beans, 5_216_126);
            }
            if (secondsLate <= 168) {
                return _scaleReward(beans, 5_320_970);
            }
            if (secondsLate <= 170) {
                return _scaleReward(beans, 5_427_921);
            }
            if (secondsLate <= 172) {
                return _scaleReward(beans, 5_537_023);
            }
            if (secondsLate <= 174) {
                return _scaleReward(beans, 5_648_317);
            }
            if (secondsLate <= 176) {
                return _scaleReward(beans, 5_761_848);
            }
            if (secondsLate <= 178) {
                return _scaleReward(beans, 5_877_661);
            }
            if (secondsLate <= 180) {
                return _scaleReward(beans, 5_995_802);
            }
        } else if (secondsLate <= 210) {
            if (secondsLate <= 182) {
                return _scaleReward(beans, 6_116_318);
            }
            if (secondsLate <= 184) {
                return _scaleReward(beans, 6_239_256);
            }
            if (secondsLate <= 186) {
                return _scaleReward(beans, 6_364_665);
            }
            if (secondsLate <= 188) {
                return _scaleReward(beans, 6_492_594);
            }
            if (secondsLate <= 190) {
                return _scaleReward(beans, 6_623_096);
            }
            if (secondsLate <= 192) {
                return _scaleReward(beans, 6_756_220);
            }
            if (secondsLate <= 194) {
                return _scaleReward(beans, 6_892_020);
            }
            if (secondsLate <= 196) {
                return _scaleReward(beans, 7_030_549);
            }
            if (secondsLate <= 198) {
                return _scaleReward(beans, 7_171_863);
            }
            if (secondsLate <= 200) {
                return _scaleReward(beans, 7_316_018);
            }
            if (secondsLate <= 202) {
                return _scaleReward(beans, 7_463_070);
            }
            if (secondsLate <= 204) {
                return _scaleReward(beans, 7_613_078);
            }
            if (secondsLate <= 206) {
                return _scaleReward(beans, 7_766_100);
            }
            if (secondsLate <= 208) {
                return _scaleReward(beans, 7_922_199);
            }
            if (secondsLate <= 210) {
                return _scaleReward(beans, 8_081_435);
            }
        } else if (secondsLate <= 240) {
            if (secondsLate <= 212) {
                return _scaleReward(beans, 8_243_872);
            }
            if (secondsLate <= 214) {
                return _scaleReward(beans, 8_409_574);
            }
            if (secondsLate <= 216) {
                return _scaleReward(beans, 8_578_606);
            }
            if (secondsLate <= 218) {
                return _scaleReward(beans, 8_751_036);
            }
            if (secondsLate <= 220) {
                return _scaleReward(beans, 8_926_932);
            }
            if (secondsLate <= 222) {
                return _scaleReward(beans, 9_106_363);
            }
            if (secondsLate <= 224) {
                return _scaleReward(beans, 9_289_401);
            }
            if (secondsLate <= 226) {
                return _scaleReward(beans, 9_476_118);
            }
            if (secondsLate <= 228) {
                return _scaleReward(beans, 9_666_588);
            }
            if (secondsLate <= 230) {
                return _scaleReward(beans, 9_860_887);
            }
            if (secondsLate <= 232) {
                return _scaleReward(beans, 10_059_091);
            }
            if (secondsLate <= 234) {
                return _scaleReward(beans, 10_261_278);
            }
            if (secondsLate <= 236) {
                return _scaleReward(beans, 10_467_530);
            }
            if (secondsLate <= 238) {
                return _scaleReward(beans, 10_677_927);
            }
        } else if (secondsLate <= 270) {
            if (secondsLate <= 242) {
                return _scaleReward(beans, 11_111_494);
            }
            if (secondsLate <= 244) {
                return _scaleReward(beans, 11_334_835);
            }
            if (secondsLate <= 246) {
                return _scaleReward(beans, 11_562_665);
            }
            if (secondsLate <= 248) {
                return _scaleReward(beans, 11_795_075);
            }
            if (secondsLate <= 250) {
                return _scaleReward(beans, 12_032_156);
            }
            if (secondsLate <= 252) {
                return _scaleReward(beans, 12_274_002);
            }
            if (secondsLate <= 254) {
                return _scaleReward(beans, 12_520_710);
            }
            if (secondsLate <= 256) {
                return _scaleReward(beans, 12_772_376);
            }
            if (secondsLate <= 258) {
                return _scaleReward(beans, 13_029_101);
            }
            if (secondsLate <= 260) {
                return _scaleReward(beans, 13_290_985);
            }
            if (secondsLate <= 262) {
                return _scaleReward(beans, 13_558_134);
            }
            if (secondsLate <= 264) {
                return _scaleReward(beans, 13_830_653);
            }
            if (secondsLate <= 266) {
                return _scaleReward(beans, 14_108_649);
            }
            if (secondsLate <= 268) {
                return _scaleReward(beans, 14_392_233);
            }
            if (secondsLate <= 270) {
                return _scaleReward(beans, 14_681_517);
            }
        } else if (secondsLate <= 300) {
            if (secondsLate <= 272) {
                return _scaleReward(beans, 14_976_615);
            }
            if (secondsLate <= 274) {
                return _scaleReward(beans, 15_277_645);
            }
            if (secondsLate <= 276) {
                return _scaleReward(beans, 15_584_726);
            }
            if (secondsLate <= 278) {
                return _scaleReward(beans, 15_897_979);
            }
            if (secondsLate <= 280) {
                return _scaleReward(beans, 16_217_528);
            }
            if (secondsLate <= 282) {
                return _scaleReward(beans, 16_543_500);
            }
            if (secondsLate <= 284) {
                return _scaleReward(beans, 16_876_025);
            }
            if (secondsLate <= 286) {
                return _scaleReward(beans, 17_215_233);
            }
            if (secondsLate <= 288) {
                return _scaleReward(beans, 17_561_259);
            }
            if (secondsLate <= 290) {
                return _scaleReward(beans, 17_914_240);
            }
            if (secondsLate <= 292) {
                return _scaleReward(beans, 18_274_317);
            }
            if (secondsLate <= 294) {
                return _scaleReward(beans, 18_641_630);
            }
            if (secondsLate <= 296) {
                return _scaleReward(beans, 19_016_327);
            }
            if (secondsLate <= 298) {
                return _scaleReward(beans, 19_398_555);
            }
            if (secondsLate <= 300) {
                return _scaleReward(beans, 19_788_466);
            }
        } else {
            return _scaleReward(beans, 20_000_000);
        }
    }

    function _scaleReward(uint256 beans, uint256 scaler) private pure returns (uint256) {
        return beans.mul(scaler).div(FRAC_EXP_PRECISION);
    }
}
