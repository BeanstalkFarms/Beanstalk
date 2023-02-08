/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "../C.sol";
import "./Curve/LibCurve.sol";
import "hardhat/console.sol";

/**
 * @author Publius, Chaikitty, Brean
 * @title Incentive Library calculates the reward and the exponential increase efficiently.
 **/
library LibIncentive {
    uint32 private constant PERIOD = 3600; //1 hour
    uint256 private constant PRECISION = 1e18;


    using SafeMath for uint256;

    // Calculates sunrise incentive amount based on current gas prices and bean/ether price
    // Further reading here: https://beanstalk-farms.notion.site/RFC-Sunrise-Payout-Change-31a0ca8dd2cb4c3f9fe71ae5599e9102
    function determineReward(
        uint256 initialGasLeft,
        uint256[2] memory balances,
        uint256 blocksLate
    ) internal view returns (uint256) {

        // Gets the current bean price based on the curve pool.
        // In the future, this can be swapped out to another oracle
        uint256 beanPriceUsd = getCurveBeanPrice(balances);

        // ethUsdPrice has 6 Decimal Precision
        uint256 beanEthPrice = getEthUsdcPrice()
            .mul(1e6)
            .div(beanPriceUsd);

        uint256 gasUsed = Math.min(initialGasLeft.sub(gasleft()) + C.getSunriseGasOverhead(), C.getMaxSunriseGas());
        uint256 gasCostWei = C.basefeeContract().block_basefee()    // (BASE_FEE
            .add(C.getSunrisePriorityFeeBuffer())                   // + PRIORITY_FEE_BUFFER)
            .mul(gasUsed);                                          // * GAS_USED
        uint256 sunriseReward =
            Math.min(
                gasCostWei.mul(beanEthPrice).div(1e18) + C.getBaseReward(), // divide by 1e18 to convert wei to eth
                C.getMaxReward()
            );
        // return fracExpOld(sunriseReward, 100, blocksLate.mul(C.getBlockLengthSeconds()), 1);
        return fracExp(sunriseReward,blocksLate);
    }

    function getCurveBeanPrice(uint256[2] memory balances) internal view returns (uint256 price) {
        uint256[2] memory rates = getRates();
        uint256[2] memory xp = LibCurve.getXP(balances, rates);
        uint256 a = C.curveMetapool().A_precise();
        uint256 D = LibCurve.getD(xp, a);
        price = LibCurve.getPrice(xp, rates, a, D);
    }

    function getEthUsdcPrice() internal view returns (uint256) {
        (int24 tick,) = OracleLibrary.consult(C.UniV3EthUsdc(),PERIOD); //1 season tick
        return OracleLibrary.getQuoteAtTick(
            tick,
            1e18,
            address(C.weth()),
            address(C.usdc())
        );
    }

    // 1.01^N
    function fracExp(uint256 beans, uint256 blocksLate) internal pure returns (uint256 scaledSunriseReward) {
        // check most likely case first
        if (blocksLate == 0) {
            return beans;
        }

        // Binary Search
        if (blocksLate < 13) {
            if (blocksLate < 7) { 
                if (blocksLate < 4) {
                    if (blocksLate < 2) {
                        // blocksLate == 0 is already checked, thus 
                        // blocksLate = 1, 1.01^(1*12)
                        return _scaleReward(beans, 1_126_825_030_131_969_720);
                    }
                    if (blocksLate == 2) { // 1.01^(2*12)
                       return _scaleReward(beans, 1_269_734_648_531_914_468);
                    }
                    else { // blocksLate == 3, 1.01^(3*12)
                        return _scaleReward(beans, 1_430_768_783_591_580_504);
                    }
                }
                if (blocksLate < 6) {
                    if (blocksLate == 4) {
                        return _scaleReward(beans, 1_612_226_077_682_464_366);
                    }
                    else { // blocksLate == 5
                        return _scaleReward(beans, 1_816_696_698_564_090_264);
                    }
                }
                else { // blocksLate == 6
                    return _scaleReward(beans, 2_047_099_312_100_130_925);
                }
            }
            if (blocksLate < 10) {
                if (blocksLate < 9) {
                    if (blocksLate == 7) {
                        return _scaleReward(beans, 2_306_722_744_040_364_517);
                    }
                    else { // blocksLate == 8
                        return _scaleReward(beans, 2_599_272_925_559_383_624);
                    }
                }
                else { // blocksLate == 9
                    return  _scaleReward(beans, 2_928_925_792_664_665_541); 
                }
            }
            if (blocksLate < 12) {
                if (blocksLate == 10) {
                    return _scaleReward(beans, 3_300_386_894_573_665_047);
                }
                else { // blocksLate == 11
                    return _scaleReward(beans, 3_718_958_561_925_128_091); 
                }
            }
            else { // blocksLate == 12
               return _scaleReward(beans, 4_190_615_593_600_829_241);
            }
        } 
        if (blocksLate < 19){
            if (blocksLate < 16) {
                if (blocksLate < 15) {
                    if (blocksLate == 13) {
                        return _scaleReward(beans, 4_722_090_542_530_756_587); 
                    }
                    else { // blocksLate == 14
                        return _scaleReward(beans, 5_320_969_817_873_109_037); 
                    }
                }
                else { // blocksLate == 15
                    return _scaleReward(beans, 5_995_801_975_356_167_528); 
                }
            }
            if (blocksLate < 18) {
                if (blocksLate == 16) {
                    return _scaleReward(beans, 6_756_219_741_546_037_047); 
                }
                else { // blocksLate == 17
                    return _scaleReward(beans, 7_613_077_513_845_821_874); 
                }
            }
            return _scaleReward(beans, 8_578_606_298_936_339_361);  // blocksLate == 18
        }
        if (blocksLate < 22) {
            if (blocksLate < 21) {
                if (blocksLate == 19) {
                    return _scaleReward(beans, 9_666_588_301_289_245_846); 
                }
                else { // blocksLate == 20
                    return _scaleReward(beans, 10_892_553_653_873_600_447); 
                }
            }
            return _scaleReward(beans, 12_274_002_099_240_216_703);  // blocksLate == 21
        }
        if (blocksLate <= 23){ 
            if (blocksLate == 22) {
                return _scaleReward(beans, 13_830_652_785_316_216_792); 
            }
            else { // blocksLate == 23
                return _scaleReward(beans, 15_584_725_741_558_756_931); 
            }
        }
        if (blocksLate > 25){ // block rewards are capped at 25 (MAX_BLOCKS_LATE)
            return _scaleReward(beans, 19_788_466_261_924_388_319); 
        } else { // blocksLate == 24
            return _scaleReward(beans, 17_561_259_053_330_430_428);
        }
    }
    
    function _scaleReward(uint256 beans, uint256 scaler) 
        private 
        pure 
        returns (uint256 scaledTemperature) 
    {
        return beans.mul(scaler).div(PRECISION);
    }


    function getRates() private view returns (uint256[2] memory rates) {
        // Decimals will always be 6 because we can only mint beans
        // 10**(36-decimals)
        return [1e30, C.curve3Pool().get_virtual_price()];
    }
}
