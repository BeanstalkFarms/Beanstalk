// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "@uniswap/v3-core/contracts/libraries/Tick.sol";
import "@uniswap/v3-core/contracts/libraries/Oracle.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3PoolDeployer.sol";

/**
 * @author Brean
 * @title MockUniswapV3Pool, allows to set the price of the oracle
 * @notice observe() is the modified function to allow this.
 **/
contract MockUniswapV3Pool {
    using Tick for mapping(int24 => Tick.Info);
    using Oracle for Oracle.Observation[65535];

    address public immutable factory;

    address public token0;

    address public token1;

    uint24 public immutable fee;

    int24 public immutable tickSpacing;

    uint128 public immutable maxLiquidityPerTick;

    // accumulated protocol fees in token0/token1 units
    struct ProtocolFees {
        uint128 token0;
        uint128 token1;
    }

    ProtocolFees public protocolFees;

    Oracle.Observation[65535] public observations;

    bool public fail_oracle_call;
    int24 public manual_ticks;
    uint256 public manual_sqrtPriceX96;

    constructor() {
        int24 _tickSpacing;
        (factory, token0, token1, fee, _tickSpacing) = IUniswapV3PoolDeployer(msg.sender)
            .parameters();
        tickSpacing = _tickSpacing;

        maxLiquidityPerTick = Tick.tickSpacingToMaxLiquidityPerTick(_tickSpacing);
    }

    function observe(
        uint32[] calldata secondsAgos
    )
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        require(!fail_oracle_call, "Oracle call failed");
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length); // not needed
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            if (i == 0) {
                tickCumulatives[i] = 0;
                continue;
            }
            tickCumulatives[i] =
                int56(manual_ticks) *
                int56(uint56(secondsAgos[secondsAgos.length - 1 - i]));
            secondsPerLiquidityCumulativeX128s[i] = 1;
        }
    }

    // sets price of oracle
    ///@dev decimal precision of price is the lower of the two tokens,
    ///@dev decimals is the precision of the token being quoted.
    function setOraclePrice(uint256 price, uint8 decimals) external {
        manual_sqrtPriceX96 = sqrt(((uint256(1 << 192)) * (10 ** decimals)) / (price));
        manual_ticks = TickMath.getTickAtSqrtRatio(uint160(manual_sqrtPriceX96));
    }

    function setOracleFailure(bool fail) external {
        fail_oracle_call = fail;
    }

    // quick helper
    function sqrt(uint256 x) private pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function setToken0(address _token0) external {
        token0 = _token0;
    }

    function setToken1(address _token1) external {
        token1 = _token1;
    }
}
