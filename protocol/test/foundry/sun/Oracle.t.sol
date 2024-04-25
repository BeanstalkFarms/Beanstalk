// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {IWell, Call, IERC20} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";

/**
 * @notice Tests the oracle portion of sunrise.
 * Oracles are used to determine the amount of beans/soil to issue to beanstalk,
 * and the BDV of an token.
 */
contract OracleTest is TestHelper {
    // Events
    event Sunrise(uint256 indexed season);
    event Soil(uint32 indexed season, uint256 soil);
    event Incentivization(address indexed account, uint256 beans);
    event TemperatureChange(uint256 indexed season, uint256 caseId, int8 absChange);
    event BeanToMaxLpGpPerBdvRatioChange(uint256 indexed season, uint256 caseId, int80 absChange);
    event WellOracle(uint32 indexed season, address well, int256 deltaB, bytes cumulativeReserves);
    event TotalGerminatingBalanceChanged(
        uint256 season,
        address indexed token,
        int256 delta,
        int256 deltaBdv
    );

    // Interfaces.
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    // test accounts.
    address[] farmers;

    // whitelisted LP tokens:
    address[] lps;

    function setUp() public {
        initializeBeanstalkTestState(true, false);
        farmers.push(users[1]);

        // add liquidity for the bean weth well, and bean wsteth well.

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            C.BEAN_ETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        // Initialize well to balances. (1000 BEAN/WSTETH)
        // note: wstETH:stETH ratio is initialized to 1:1.
        addLiquidityToWell(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 wstETH.
        );

        lps = bs.getWhitelistedWellLpTokens();

        // upon the first sunrise call of a well, the well cumulative reserves are initialized,
        // and will not return a deltaB. We initialize the well cumulative reserves here.
        // See: {LibWellMinting.capture}
        season.initOracleForAllWhitelistedWells();

        // chainlink oracles need to be initialized for the wells.
        initializeChainlinkOraclesForWhitelistedWells();
    }

    ///////// STEP ORACLE /////////

    /**
     * @notice validates oracle functionality.
     */
    function test_stepOracleDefault() public {
        uint32 currentSeason = bs.season();
        int256 totalDeltaB;
        // verify well oracle event.
        for (uint i; i < lps.length; i++) {
            Call memory pump = IWell(lps[i]).pumps()[0];
            (, bytes memory data) = ICumulativePump(pump.target).readTwaReserves(
                lps[i],
                bs.wellOracleSnapshot(lps[i]),
                bs.getSeasonTimestamp(),
                pump.data
            );
            int256 deltaB = bs.poolDeltaB(lps[i]);
            vm.expectEmit();
            emit WellOracle(currentSeason, lps[i], deltaB, data);
        }
        season.captureE();
    }

    /**
     * @notice validates oracle functionality. Change in deltaB.
     */
    function test_stepOracleDeltaB(uint256 entropy) public {
        int256[] memory deltaBPerWell = setDeltaBForWellsWithEntropy(entropy);
        uint32 currentSeason = bs.season();

        // verify well oracle event.
        for (uint i; i < lps.length; i++) {
            Call memory pump = IWell(lps[i]).pumps()[0];
            (, bytes memory data) = ICumulativePump(pump.target).readTwaReserves(
                lps[i],
                bs.wellOracleSnapshot(lps[i]),
                bs.getSeasonTimestamp(),
                pump.data
            );
            // deltaB may differ by 1 due to rounding errors.
            // validate poolDeltaB with calculated deltaB.
            int256 poolDeltaB = season.getPoolDeltaBWithoutCap(lps[i]);
            assertApproxEqAbs(poolDeltaB, deltaBPerWell[i], 1);
            vm.expectEmit();
            emit WellOracle(currentSeason, lps[i], poolDeltaB, data);
        }
        season.captureE();
    }

    /**
     * @notice tests that the deltaB for a well is capped at 1% of supply.
     */
    function test_oracleCappedDeltaB(uint256 entropy) public {
        int256[] memory deltaBPerWell = setDeltaBForWellsWithEntropy(entropy);
        for (uint i; i < lps.length; i++) {
            int256 poolDeltaB = bs.poolDeltaB(lps[i]);
            uint256 beanSupply = C.bean().totalSupply();
            assertLe(uint256(abs(poolDeltaB)), beanSupply);
        }
    }
}
