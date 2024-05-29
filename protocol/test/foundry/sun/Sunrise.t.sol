// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockPump} from "contracts/mocks/well/MockPump.sol";
import {IWell, Call, IERC20} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";

/**
 * @notice Tests the various parts of sunrise.
 * @dev `Sunrise` is the function that advances the season, and issues rewards.
 *
 * The Sunrise can be seperated into the following parts:
 * - stepSeason() - increments season.
 * - stepOracle() - reads oracles from whitelisted silo wells.
 * - calcCaseIdAndUpdate() - determines and evaluates the beanstalk state, and updates temperature and bean to max lp gp per bdv ratio.
 * - endTotalGermination() - ends the germination process for all whitelisted tokens.
 * - stepGauge() - iterates through the gauge system.
 * - stepSun() - distrbuted newly minted beans to the barn, field, and silo, and issues new soil to the field.
 * - Incentive() - rewards beans to the caller.
 */
contract SunriseTest is TestHelper {
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

    uint256 constant SEASON_DURATION = 3600;

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

        // // the `sunrise` function can only be called at the top of the hour.
        // // {initializeBeanstalkTestState} initializes beanstalk at START_TIMESTAMP {See testHelper.sol}
        // // since beanstalk starts at season 1, 2 hours need to pass in order for the first season to end.
        // skip(SEASON_DURATION);

        // upon the first sunrise call of a well, the well cumulative reserves are initialized,
        // and will not return a deltaB. We initialize the well cumulative reserves here.
        // See: {LibWellMinting.capture}
        season.initOracleForAllWhitelistedWells();

        // chainlink oracles need to be initialized for the wells.
        initializeChainlinkOraclesForWhitelistedWells();
    }

    /**
     * @notice tests that the sunrise will revert, if not enough time has elapsed.
     * @dev `s` hours need to elapse from the start of beanstalk in order for beanstalk
     * to accept a sunrise call. `s` is the current season, found at s.sys.season.current.
     */
    function test_sunriseRevert(uint256 s, uint256 timestamp) public {
        s = bound(s, 1, type(uint32).max);
        timestamp = bound(timestamp, 0, (s * SEASON_DURATION) - 1);
        skip(timestamp);
        season.setCurrentSeasonE(uint32(s));
        vm.expectRevert("Season: Still current Season.");
        season.sunrise();
    }

    /////////// VERIFY SUNRISE EXECUTION ///////////

    /**
     * Assuming a correct timestamp, the sunrise function MUST succeed.
     * Otherwise, beanstalk is frozen and cannot iterate.
     * Thus, we test that the sunrise function succeeds in extreme conditions.
     */

    /**
     * @notice sunrise should succeed if whitelisted lp pumps are not initialized.
     */
    function test_sunriseNoWells() public {
        warpToNextSeasonTimestamp();

        uninitializeWellPumps();
        callSunriseAndCheckEvents(false);
    }

    /**
     * @notice sunrise should succeed if any oracle fails.
     * @dev assumes a mock oracle.
     */
    function test_sunriseOracleFailure(uint256 oracleIndex) public {
        warpToNextSeasonTimestamp();

        // see OracleDeployer.sol for the chainlink oracles.
        // create an invalid round to one of the wells.
        oracleIndex = bound(oracleIndex, 0, chainlinkOracles.length - 1);
        mockAddInvalidRound(chainlinkOracles[oracleIndex]);

        callSunriseAndCheckEvents(false);
    }

    /**
     * @notice general sunrise test. Verfies that the sunrise function
     * can be executed no matter how late the call is.
     */
    function test_lateSunrise(uint256 s, uint256 secondsLate) public {
        // max season is type(uint32).max - 2.
        s = bound(s, 1, type(uint32).max - 2);
        season.setCurrentSeasonE(uint32(s));
        warpToNextSeasonTimestamp();

        uint256 maxTimestamp = (type(uint32).max * SEASON_DURATION + INITIAL_TIMESTAMP);
        uint256 secondsLate = bound(secondsLate, 0, maxTimestamp - block.timestamp);
        skip(secondsLate);
        callSunriseAndCheckEvents(false);
    }

    ///////// STEP SEASON /////////

    /**
     * @notice validates that the season is incremented correctly.
     */
    function test_stepSeason(uint256 s) public {
        s = bound(s, 1, type(uint32).max - 1);
        season.setCurrentSeasonE(uint32(s));

        vm.expectEmit();
        emit Sunrise(s + 1);
        season.mockStepSeason();

        assertEq(bs.season(), s + 1);
        assertEq(bs.sunriseBlock(), block.number);
    }

    ///////// STEP ORACLE /////////

    ///////// BEANSTALK EVALUATION AND UPDATE /////////

    /**
     * @notice see {Cases.t.sol}
     */

    ///////// GERMINATION /////////

    /**
     * @notice see {Germination.t.sol}
     */

    ///////// GAUGE /////////

    /**
     * @notice see {Gauge.t.sol}
     */

    ///////// Sun /////////

    /**
     * @notice see {Sun.t.sol}
     */

    ///////// INCENTIVE /////////

    // TODO: foundry tests cannot properly test the sunrise incentive,
    // due to gasLeft() bugs. https://github.com/foundry-rs/foundry/issues/5621

    ////// HELPER FUNCTIONS //////

    function callSunriseAndCheckEvents(bool wellsEnabled) internal {
        vm.pauseGasMetering();

        uint256 currentSeason = bs.season();
        uint256 newSeason = currentSeason + 1;

        // season event
        vm.expectEmit();
        emit Sunrise(newSeason);

        // Temperature changes.
        vm.expectEmit(false, false, false, false);
        emit TemperatureChange(newSeason, 0, 0);

        // Ratio changes.
        if (wellsEnabled) {
            vm.expectEmit(false, false, false, false);
            emit BeanToMaxLpGpPerBdvRatioChange(newSeason, 0, 0);
        }

        // Soil Issuance.
        vm.expectEmit(false, false, false, false);
        emit Soil(uint32(newSeason), 0);

        // sunrise incentive event.
        vm.expectEmit(false, false, false, false);
        emit Incentivization(address(this), 5e6);

        vm.resumeGasMetering();

        season.sunrise();
    }

    /**
     * @notice clears data for all whitelisted LP tokens.
     * Assumes the first pump attached for each token is a mock pump.
     */
    function uninitializeWellPumps() internal noGasMetering {
        address[] memory lp = bs.getWhitelistedLpTokens();
        for (uint i; i < lp.length; i++) {
            MockPump(IWell(lp[i]).pumps()[0].target).clearReserves(lp[i]);
        }
    }

    /**
     * @notice gets the next time the sunrise can be called,
     * and warps the time to that timestamp.
     */
    function warpToNextSeasonTimestamp() internal noGasMetering {
        uint256 nextTimestamp = season.getNextSeasonStart();
        vm.warp(nextTimestamp);
    }
}
