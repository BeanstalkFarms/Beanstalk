// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import {IBlockBasefee} from "../interfaces/IBlockBasefee.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "../C.sol";
import "./Curve/LibCurve.sol";

/**
 * @title LibIncentive
 * @author Publius, Chaikitty, Brean
 * @notice Calculates the reward offered for calling Sunrise, adjusts for current gas & ETH prices,
 * and scales the reward up when the Sunrise is called late.
 */
library LibIncentive {
    using SafeMath for uint256;

    /// @dev The time range over which to consult the Uniswap V3 ETH:USDC pool oracle. Measured in seconds.
    uint32 internal constant PERIOD = 3600; // 1 hour

    /// @dev The Sunrise reward reaches its maximum after this many blocks elapse.
    uint256 internal constant MAX_BLOCKS_LATE = 25;

    /// @dev Base BEAN reward to cover cost of operating a bot.
    uint256 internal constant BASE_REWARD = 3e6;  // 3 BEAN

    /// @dev Max BEAN reward for calling Sunrise. 
    uint256 internal constant MAX_REWARD = 100e6; // 100 BEAN

    /// @dev Wei buffer to account for the priority fee.
    uint256 internal constant PRIORITY_FEE_BUFFER = 5e9; // 5e9 wei = 5 gwei

    /// @dev The maximum gas which Beanstalk will pay for a Sunrise transaction.
    uint256 internal constant MAX_SUNRISE_GAS = 500_000; // 500k gas

    /// @dev Accounts for extra gas overhead for completing a Sunrise tranasaction.
    // 21k gas (base cost for a transction) + ~29k gas for other overhead
    uint256 internal constant SUNRISE_GAS_OVERHEAD = 50_000; // 50k gas

    /// @dev Use external contract for block.basefee as to avoid upgrading existing contracts to solidity v8
    address private constant BASE_FEE_CONTRACT = 0x84292919cB64b590C0131550483707E43Ef223aC;

    //////////////////// CALCULATE REWARD ////////////////////

    /**
     * @param initialGasLeft The amount of gas left at the start of the transaction
     * @param balances The current balances of the BEAN:3CRV pool returned by {stepOracle}
     * @param blocksLate The number of blocks late that {sunrise()} was called.
     * @dev Calculates Sunrise incentive amount based on current gas prices and a computed
     * BEAN:ETH price. This function is called at the end of {sunriseTo()} after all
     * "step" functions have been executed.
     * 
     * Price calculation:
     * `X := BEAN / USD`
     * `Y := ETH / USDC`
     * `Y / X := (ETH/USDC)/(BEAN/USD) := ETH / BEAN` (assuming 1 USD == 1 USDC)
     */
    function determineReward(
        uint256 initialGasLeft,
        uint256[2] memory balances,
        uint256 blocksLate
    ) internal view returns (uint256) {
        // Gets the current BEAN/USD price based on the Curve pool.
        // In the future, this can be swapped out to another oracle
        uint256 beanUsdPrice = getBeanUsdPrice(balances); // BEAN / USD

        // `getEthUsdcPrice()` has 6 decimal precision
        // Assumption: 1 USDC = 1 USD
        uint256 beanEthPrice = getEthUsdcPrice() // WETH / USDC
            .mul(1e6)
            .div(beanUsdPrice);

        // Cap the maximum number of blocks late. If the sunrise is later than
        // this, Beanstalk will pay the same amount. Prevents unbounded return value.
        if (blocksLate > MAX_BLOCKS_LATE) {
            blocksLate = MAX_BLOCKS_LATE;
        }

        // Sunrise gas overhead includes:
        //  - 21K for base transaction cost
        //  - 29K for calculations following the below line, like {fracExp}
        // Max gas which Beanstalk will pay for = 500K.
        uint256 gasUsed = Math.min(
            initialGasLeft.sub(gasleft()) + SUNRISE_GAS_OVERHEAD,
            MAX_SUNRISE_GAS
        );

        // Calculate the current cost in Wei of `gasUsed` gas.
        // {block_basefee()} returns the base fee of the current block in Wei.
        // Adds a buffer for priority fee.
        uint256 gasCostWei = IBlockBasefee(BASE_FEE_CONTRACT).block_basefee()    // (BASE_FEE
            .add(PRIORITY_FEE_BUFFER)                                            // + PRIORITY_FEE_BUFFER)
            .mul(gasUsed);                                                       // * GAS_USED
        
        // Calculates the Sunrise reward to pay in BEAN.
        uint256 sunriseReward = Math.min(
            BASE_REWARD + gasCostWei.mul(beanEthPrice).div(1e18), // divide by 1e18 to convert wei to eth
            MAX_REWARD
        );

        // Scale the reward up as the number of blocks after expected sunrise increases. 
        // `sunriseReward * (1 + 1/100)^(blocks late * seconds per block)`
        // NOTE: 1.01^(25 * 12) = 19.78, This is the maximum multiplier.
        // FIXME: compute discretely for all 25 values?
        return fracExp(
            sunriseReward,
            100,
            blocksLate.mul(C.BLOCK_LENGTH_SECONDS),
            1
        );
    }

    //////////////////// PRICES ////////////////////

    /**
     * @param balances The current balances of the BEAN:3CRV pool returned by {stepOracle}.
     * @dev Calculate the price of BEAN denominated in USD.
     */
    function getBeanUsdPrice(uint256[2] memory balances) internal view returns (uint256) {
        uint256[2] memory rates = getRates();
        uint256[2] memory xp = LibCurve.getXP(balances, rates);
        
        uint256 a = C.curveMetapool().A_precise();
        uint256 D = LibCurve.getD(xp, a);
        
        return LibCurve.getPrice(xp, rates, a, D);
    }

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of WETH denominated in USDC.
     * 
     * {OracleLibrary.getQuoteAtTick} returns an arithmetic mean.
     */
    function getEthUsdcPrice() internal view returns (uint256) {
        (int24 tick,) = OracleLibrary.consult(C.UNIV3_ETH_USDC_POOL, PERIOD); // 1 season tick
        return OracleLibrary.getQuoteAtTick(
            tick,
            1e18,
            C.WETH,
            C.USDC
        );
    }

    function getRates() private view returns (uint256[2] memory) {
        // Decimals will always be 6 because we can only mint beans
        // 10**(36-decimals)
        return [1e30, C.curve3Pool().get_virtual_price()];
    }

    //////////////////// MATH UTILITIES ////////////////////
    
    /**
     * @notice fracExp estimates an exponential expression in the form: k * (1 + 1/q) ^ N.
     * We use a binomial expansion to estimate the exponent to avoid running into integer overflow issues.
     * @param k - the principle amount
     * @param q - the base of the fraction being exponentiated
     * @param n - the exponent
     * @param x - the excess # of times to run the iteration.
     * @return s - the solution to the exponential equation
     */
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

    /**
     * @notice log_two calculates the log2 solution in a gas efficient manner
     * Motivation: https://ethereum.stackexchange.com/questions/8086
     * @param x - the base to calculate log2 of
     */
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
}
