/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "../C.sol";
import "./Curve/LibCurve.sol";

/**
 * @author Publius, Chaikitty
 * @title Incentive Library calculates the reward and the exponential increase efficiently.
 **/
library LibIncentive {

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
        uint256 beanPriceUsd = LibIncentive.getCurveBeanPrice(balances);

        // ethUsdPrice has 8 decimal precision, bean has 6.
        uint256 beanEthPrice = C.chainlinkContract().latestAnswer() // Eth price in USD (8 decimals)
            .mul(1e4)           // Multiplies eth by 1e4 so that the result of division will also have 6 decimals
            .div(beanPriceUsd); // number of beans required to purchase one eth

        uint256 gasUsed = Math.min(initialGasLeft.sub(gasleft()) + C.getSunriseGasOverhead(), C.getMaxSunriseGas());
        uint256 gasCostWei = C.basefeeContract().block_basefee()    // (BASE_FEE
            .add(C.getSunrisePriorityFeeBuffer())                   // + PRIORITY_FEE_BUFFER)
            .mul(gasUsed);                                          // * GAS_USED
        uint256 sunriseReward = Math.max(
            C.getMinReward(),
            Math.min(
                gasCostWei.mul(beanEthPrice).div(1e18) + C.getBaseReward(), // divide by 1e18 to convert wei to eth
                C.getMaxReward()
            )
        );

        return LibIncentive.fracExp(sunriseReward, 100, blocksLate.mul(C.getBlockLengthSeconds()), 1);
    }

    function getCurveBeanPrice(uint256[2] memory balances) internal view returns (uint256 price) {
        uint256[2] memory rates = getRates();
        uint256[2] memory xp = LibCurve.getXP(balances, rates);
        uint256 a = C.curveMetapool().A_precise();
        uint256 D = LibCurve.getD(xp, a);
        price = LibCurve.getPrice(xp, rates, a, D);
    }

    /// @notice fracExp estimates an exponential expression in the form: k * (1 + 1/q) ^ N.
    /// We use a binomial expansion to estimate the exponent to avoid running into integer overflow issues.
    /// @param k - the principle amount
    /// @param q - the base of the fraction being exponentiated
    /// @param n - the exponent
    /// @param x - the excess # of times to run the iteration.
    /// @return s - the solution to the exponential equation
    function fracExp(
        uint256 k,
        uint256 q,
        uint256 n,
        uint256 x
    ) internal pure returns (uint256 s) {
        // The upper bound in which the binomial expansion is expected to converge
        // Upon testing with a limit of n <= 300, x = 2, k = 100, q = 100 (parameters Beanstalk currently uses)
        // we found this p optimizes for gas and error
        uint256 p = log_two(n) + 1 + (x * n) / q;
        // Solution for binomial expansion in Solidity.
        // Motivation: https://ethereum.stackexchange.com/questions/10425
        uint256 N = 1;
        uint256 B = 1;
        for (uint256 i; i < p; ++i) {
            s += (k * N) / B / (q**i);
            N = N * (n - i);
            B = B * (i + 1);
        }
    }

    /// @notice log_two calculates the log2 solution in a gas efficient manner
    /// Motivation: https://ethereum.stackexchange.com/questions/8086
    /// @param x - the base to calculate log2 of
    function log_two(uint256 x) private pure returns (uint256 y) {
        assembly {
            let arg := x
            x := sub(x, 1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            let m := mload(0x40)
            mstore(
                m,
                0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd
            )
            mstore(
                add(m, 0x20),
                0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe
            )
            mstore(
                add(m, 0x40),
                0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616
            )
            mstore(
                add(m, 0x60),
                0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff
            )
            mstore(
                add(m, 0x80),
                0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e
            )
            mstore(
                add(m, 0xa0),
                0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707
            )
            mstore(
                add(m, 0xc0),
                0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606
            )
            mstore(
                add(m, 0xe0),
                0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100
            )
            mstore(0x40, add(m, 0x100))
            let
                magic
            := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let
                shift
            := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(x, magic), shift)
            y := div(mload(add(m, sub(255, a))), shift)
            y := add(
                y,
                mul(
                    256,
                    gt(
                        arg,
                        0x8000000000000000000000000000000000000000000000000000000000000000
                    )
                )
            )
        }
    }

    function getRates() private view returns (uint256[2] memory rates) {
        // Decimals will always be 6 because we can only mint beans
        // 10**(36-decimals)
        return [1e30, C.curve3Pool().get_virtual_price()];
    }
}
