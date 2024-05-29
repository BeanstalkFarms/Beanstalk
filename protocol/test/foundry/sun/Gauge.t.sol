// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IMockFBeanstalk, MockToken, C, IWell, LibWell} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {MockChainlinkAggregator} from "contracts/mocks/chainlink/MockChainlinkAggregator.sol";
import {MockLiquidityWeight} from "contracts/mocks/MockLiquidityWeight.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";

/**
 * @notice Tests the functionality of the gauge.
 */
contract GaugeTest is TestHelper {
    event UpdatedSeedGaugeSettings(IMockFBeanstalk.SeedGaugeSettings);
    event BeanToMaxLpGpPerBdvRatioChange(uint256 indexed season, uint256 caseId, int80 absChange);

    // Interfaces.
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
    MockLiquidityWeight lw = MockLiquidityWeight(BEANSTALK);

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // deploy mockLiquidityWeight contract for testing.
        lw = new MockLiquidityWeight(0.5e18);
    }

    ////////////////////// BEAN TO MAX LP RATIO //////////////////////

    /**
     * @notice the bean to max LP ratio should never go below 0%.
     */
    function test_beanToMaxLpMin(uint256 initBeanToMaxLPRatio, uint256 caseId) public {
        initBeanToMaxLPRatio = bound(initBeanToMaxLPRatio, 0, 1e18 - 1);

        // create caseId such that BeanToMaxLP always decreases. See {LibEvaluate}.
        caseId = bound(caseId, 0, 143);
        uint256 foo = caseId % 9;
        if (foo < 3) caseId = caseId + (3 - foo);

        // set the bean to max lp to < 1 point.
        season.setBeanToMaxLpGpPerBdvRatio(uint128(initBeanToMaxLPRatio));

        // iterate through the sunrise with the case.
        vm.expectEmit();
        emit BeanToMaxLpGpPerBdvRatioChange(
            bs.season() + 1,
            caseId,
            -int80(uint80(initBeanToMaxLPRatio))
        );
        season.seedGaugeSunSunrise(0, caseId);

        assertEq(bs.getBeanToMaxLpGpPerBdvRatio(), 0);
    }

    /**
     * @notice the bean to max LP ratio should never exceed 100%.
     */
    function test_beanToMaxLpMax(uint256 initBeanToMaxLPRatio, uint256 caseId) public {
        initBeanToMaxLPRatio = bound(initBeanToMaxLPRatio, 99e18, 100e18 - 1);

        // create caseId such that BeanToMaxLP always increases. See {LibEvaluate}.
        caseId = bound(caseId, 72, 143);
        uint256 foo = caseId % 9;
        if (foo > 2) caseId = caseId - foo;

        // set the bean to max lp to < 1 point.
        season.setBeanToMaxLpGpPerBdvRatio(uint128(initBeanToMaxLPRatio));

        // iterate through the sunrise with the case.
        vm.expectEmit();
        emit BeanToMaxLpGpPerBdvRatioChange(
            bs.season() + 1,
            caseId,
            100e18 - int80(uint80(initBeanToMaxLPRatio))
        );
        season.seedGaugeSunSunrise(0, caseId);

        assertEq(bs.getBeanToMaxLpGpPerBdvRatio(), 100e18);
    }

    ////////////////////// BEAN TO MAX LP SCALAR //////////////////////

    /**
     * @notice verifies that the bean to max LP properly scales up.
     * @dev these tests verify the specific scalar implementation.
     * Changing the scalar implementation will most likely break these tests.
     * See {LibGauge.getBeanToMaxLpGpPerBdvRatioScaled}.
     */
    function test_beanToMaxLP_scaled(
        uint256 initBeanToMaxLPRatio,
        uint256 beanMaxLpRatioChange
    ) public {
        initBeanToMaxLPRatio = bound(initBeanToMaxLPRatio, 0, 100e18);
        bs.setBeanToMaxLpGpPerBdvRatio(uint128(initBeanToMaxLPRatio));
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 scaledRatio = bs.getBeanToMaxLpGpPerBdvRatioScaled();
        // scaled ratio should never fall below 50%.
        assertGe(scaledRatio, s.sys.seedGaugeSettings.minBeanMaxLpGpPerBdvRatio);

        // scaled ratio should never exceed 100%.
        assertLe(scaledRatio, s.sys.seedGaugeSettings.maxBeanMaxLpGpPerBdvRatio);

        // the scaledRatio should increase half as fast as the initBeanToMaxLPRatio.
        assertEq(
            scaledRatio - s.sys.seedGaugeSettings.minBeanMaxLpGpPerBdvRatio,
            initBeanToMaxLPRatio / 2
        );
    }

    ////////////////////// L2SR //////////////////////

    /**
     * @notice verifies getters with no liquidity.
     */
    function test_L2SRNoLiquidity(uint256 index) public {
        C.bean().mint(users[0], 100e6);
        address[] memory whitelistedWellTokens = bs.getWhitelistedWellLpTokens();
        index = bound(index, 0, whitelistedWellTokens.length - 1);
        address well = whitelistedWellTokens[index];
        assertEq(bs.getLiquidityToSupplyRatio(), 0, "invalid liq to supply ratio");
        assertEq(bs.getTwaLiquidityForWell(well), 0, "invalid twa liq for well");
        assertEq(bs.getWeightedTwaLiquidityForWell(well), 0, "invalid weighted twa liq for well");
        assertEq(bs.getTotalUsdLiquidity(), 0, "invalid total liq");
        assertEq(bs.getTotalWeightedUsdLiquidity(), 0, "invalid total weighted liq");
    }

    /**
     * @notice verifies getters with no supply.
     */
    function test_L2SRNoSupply() public {
        assertEq(bs.getLiquidityToSupplyRatio(), 0, "invalid liq to supply ratio");
        assertEq(bs.getTotalUsdLiquidity(), 0, "invalid total liq");
        assertEq(bs.getTotalWeightedUsdLiquidity(), 0, "invalid total weighted liq");
    }

    /**
     * @notice verifies L2SR functionality.
     */
    function test_L2SR_func(uint256 nonBeanAmount, uint256 beansIssued) public {
        vm.pauseGasMetering();
        address[] memory whitelistedWellTokens = bs.getWhitelistedWellLpTokens();
        beansIssued = bound(beansIssued, 0, type(uint128).max);
        uint256 totalNonBeanValue;
        for (uint i; i < whitelistedWellTokens.length; i++) {
            address well = whitelistedWellTokens[i];
            nonBeanAmount = bound(nonBeanAmount, 1e18, type(uint80).max);
            totalNonBeanValue += addLiquidityAndReturnNonBeanValue(well, nonBeanAmount);

            // hash to output different beans for next loop.
            nonBeanAmount = uint256(keccak256(abi.encode(nonBeanAmount)));
        }
        vm.resumeGasMetering();
        assertEq(bs.getTotalUsdLiquidity(), totalNonBeanValue);
        uint256 l2sr = bs.getLiquidityToSupplyRatio();
        // all beans are in the pool, and thus should have a ~100% L2SR (small imprecision due to rounding).
        assertGe(l2sr, 1e18, "l2sr < 1e18");
        assertApproxEqRel(l2sr, 1e18, 1e8, "invalid l2sr");

        uint256 snapshot = vm.snapshot();

        // verify L2SR decreases with an increase in bean supply.
        C.bean().mint(users[1], beansIssued);
        uint256 l2srIncreasedBeans = bs.getLiquidityToSupplyRatio();
        assertLe(l2srIncreasedBeans, l2sr, "l2sr did not decrease");

        // verify L2SR increases with an decrease in bean supply.
        vm.prank(users[1]);
        C.bean().burn(beansIssued);
        assertGe(bs.getLiquidityToSupplyRatio(), l2srIncreasedBeans, "l2sr did not increase");
    }

    /**
     * @notice verifies L2SR functionality, updates weight.
     */
    function test_liquidityWeightUpdate(uint256 rand) public {
        address[] memory whitelistedWellTokens = bs.getWhitelistedWellLpTokens();
        rand = bound(rand, 0, whitelistedWellTokens.length - 1);
        uint256 totalNonBeanValue;
        for (uint i; i < whitelistedWellTokens.length; i++) {
            address well = whitelistedWellTokens[i];
            totalNonBeanValue += addLiquidityAndReturnNonBeanValue(well, 10e18);
        }
        assertEq(bs.getTotalWeightedUsdLiquidity(), totalNonBeanValue);

        // update liquidtyWeight.
        bs.mockUpdateLiquidityWeight(
            whitelistedWellTokens[rand],
            address(lw),
            0x00,
            lw.getLiquidityWeight.selector
        );

        // 1 out of 2 whitelisted lp tokens should have updated weight.
        // mockLiquidityWeight has a 50% reduction in weight. total Weighted value should decrease by 25%.
        assertEq(bs.getTotalWeightedUsdLiquidity(), (totalNonBeanValue * 3) / 4);
        assertApproxEqRel(bs.getLiquidityToSupplyRatio(), 0.75e18, 0.01e6);
    }

    ////////////////////// AVERAGE GROWN STALK PER BDV PER SEASON //////////////////////

    /**
     * @notice verifies that the average grown stalk per season does not change if the season is less than the catchup season.
     */
    function test_avgGrownStalkPerBdv_noChange(uint256 season) public {
        season = bound(season, 0, bs.getTargetSeasonsToCatchUp() - 1);
        uint256 initialAvgGrownStalkPerBdvPerSeason = bs.getAverageGrownStalkPerBdvPerSeason();
        depositForUser(users[1], C.BEAN, 100e6);

        bs.fastForward(uint32(season));

        // the user must mow as unmowed grown stalk cannot be tracked.
        vm.prank(users[1]);
        bs.mow(users[1], C.BEAN);
        // attempt to update average grown stalk per bdv per season (done during the sunrise function).
        bs.mockUpdateAverageGrownStalkPerBdvPerSeason();

        assertEq(
            uint256(bs.getAverageGrownStalkPerBdvPerSeason()),
            initialAvgGrownStalkPerBdvPerSeason
        );
    }

    /**
     * @notice verifies that the average grown stalk per season changes after the catchup season.
     */
    function test_avgGrownStalkPerBdv_changes(uint256 season) public {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // season is capped to uint32 max - 1.
        season = bound(
            season,
            s.sys.seedGaugeSettings.targetSeasonsToCatchUp,
            type(uint32).max - 1
        );
        depositForUser(users[1], C.BEAN, 100e6);

        bs.fastForward(uint32(season));

        // the user must mow as unmowed grown stalk cannot be tracked.
        vm.prank(users[1]);
        bs.mow(users[1], C.BEAN);
        // update average grown stalk per bdv per season (done during the gauge portion of sunrise).
        bs.mockUpdateAverageGrownStalkPerBdvPerSeason();

        // verify that the averageGrownStalkPerBdvPerSeason has increased.
        // note: beanstalk initializes the averageGrownStalkPerBdvPerSeason to 3e6,
        // but assumes a 50/50 split between bean/lp deposits. Thus, the actual average is 2e6.
        assertGe(uint256(bs.getAverageGrownStalkPerBdvPerSeason()), 2e6);
    }

    // oracle failure //

    /**
     * @notice verfies seed system skips upon an oracle failure.
     */
    function test_seedGauge_oracleFailure() public {
        uint256 initBeanToMaxLpRatio = bs.getBeanToMaxLpGpPerBdvRatio();
        uint256 initBeanEthGaugePoints = bs.getGaugePoints(C.BEAN_ETH_WELL);
        uint256 initBeanSeeds = bs.tokenSettings(C.BEAN).stalkEarnedPerSeason;
        uint256 initBeanEthSeeds = bs.tokenSettings(C.BEAN_ETH_WELL).stalkEarnedPerSeason;

        // set oracle failure, verify unchanged values.
        MockChainlinkAggregator(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR).setOracleFailure();
        MockChainlinkAggregator(C.WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR).setOracleFailure();

        assertEq(bs.getBeanToMaxLpGpPerBdvRatio(), initBeanToMaxLpRatio);
        assertEq(bs.getGaugePoints(C.BEAN_ETH_WELL), initBeanEthGaugePoints);
        assertEq(bs.tokenSettings(C.BEAN).stalkEarnedPerSeason, initBeanSeeds);
        assertEq(bs.tokenSettings(C.BEAN_ETH_WELL).stalkEarnedPerSeason, initBeanEthSeeds);
    }

    ////////////////////// LOCKED BEANS //////////////////////

    /**
     * verifies locked beans functionality for unripe beans.
     * note: unripe LP follows the same methodology,
     * but has an additional step to derive the locked beans from LP.
     */
    function test_lockedBeansUnderBeans(uint256 addedBeans) public {
        initializeLockedBeans();
        addedBeans = bound(addedBeans, 0, MockToken(C.UNRIPE_BEAN).totalSupply() - 1000e6);

        uint256 lockedBeans = bs.getLockedBeansUnderlyingUnripeBean();

        // add additional beans to unripe beans.
        addUnderlyingToUnripeBean(0, addedBeans);

        // verify the locked beans increased.
        assertGe(bs.getLockedBeansUnderlyingUnripeBean(), lockedBeans);
        uint256 totalUnderlying = bs.getTotalUnderlying(C.UNRIPE_BEAN);
        assertEq(
            bs.getLockedBeansUnderlyingUnripeBean(),
            (totalUnderlying * 0.4363321054081788e18) / 1e18
        );
    }

    function test_lockedBeansSupply90Million(uint256 supply) public {
        initializeLockedBeans();
        uint256 lockedBeans = bs.getLockedBeansUnderlyingUnripeBean();

        // initial supply is 20 million urBean.
        // deduct < 10m and verify that locked beans amount do not change.
        supply = bound(supply, 0, 10000000e6 - 1e6);
        vm.prank(users[0]);
        MockToken(C.UNRIPE_BEAN).burn(supply);
        assertEq(bs.getLockedBeansUnderlyingUnripeBean(), lockedBeans);
    }

    function test_lockedBeansSupply10Million(uint256 burntBeans) public {
        initializeLockedBeans();
        // initial supply is 20 million urBean.
        // deduct 10m < x< 15m and verify that locked beans amount are within a range.
        burntBeans = bound(burntBeans, 10000000e6 + 1e6, 15000000e6 - 1e6);
        uint256 lockedBeansPercent = burnBeansAndCheckLockedBeans(burntBeans);
        // 1e-12% precision.
        assertApproxEqRel(lockedBeansPercent, 0.5156047910307769e18, 1e6); // see {LibLockedUnderlying}
    }

    function test_lockedBeansSupply5Million(uint256 burntBeans) public {
        initializeLockedBeans();

        // initial supply is 20 million urBean.
        // deduct 15m < x< 19m and verify that locked beans amount are within a range.
        burntBeans = bound(burntBeans, 15000000e6 + 1e6, 19000000e6 - 1e6);
        uint256 lockedBeansPercent = burnBeansAndCheckLockedBeans(burntBeans);
        // 1e-12% precision.
        assertApproxEqRel(lockedBeansPercent, 0.5795008171102514e18, 1e6); // see {LibLockedUnderlying}
    }

    /**
     * verifies locked beans are MEV resistant.
     */
    function test_lockedBeansMEVResistant(uint256 addedBeans) public {
        initializeLockedBeans();

        uint256 initialLockedBeans = bs.getLockedBeansUnderlyingUnripeLP();

        // add liquidity to unripeLP well.
        // Note: {addLiqudityToWell} is not used as sync() is called to manipulate the reserves.
        // Additionally, calling sync() multiple times to update reserves only works for the MockPump and should
        // not work for the multiFlowPump.

        address underlyingWell = bs.getUnderlyingToken(C.UNRIPE_LP);
        (address nonBeanToken, ) = LibWell.getNonBeanTokenAndIndexFromWell(underlyingWell);

        // mint and sync.
        MockToken(C.BEAN).mint(underlyingWell, 1000000e6);
        MockToken(nonBeanToken).mint(underlyingWell, 1000 ether);

        // initial liquidity owned by beanstalk deployer.
        uint256 lpOut = IWell(underlyingWell).sync(users[0], 0);

        uint256 newLockedBeans = bs.getLockedBeansUnderlyingUnripeLP();
        assertEq(initialLockedBeans, newLockedBeans);
    }

    /**
     * @notice verifies that the total locked beans is the summation
     * of the locked beans underlying Bean and LP.
     */
    function test_lockedBeansTotal(uint256 addedBeans) public {
        initializeLockedBeans();
        addedBeans = bound(addedBeans, 0, MockToken(C.UNRIPE_BEAN).totalSupply() - 1000e6);

        // add additional underlying to beans:
        addUnderlyingToUnripeBean(0, addedBeans);
        uint256 lockedBeans = bs.getLockedBeansUnderlyingUnripeBean();
        lockedBeans = lockedBeans + bs.getLockedBeansUnderlyingUnripeLP();

        assertEq(lockedBeans, bs.getLockedBeans());
    }

    ////////////////////// BEAN <> 1 LP GAUGE //////////////////////

    /**
     * When beanstalk has 1 LP token whitelisted, the gauge system adjusts
     * the bean and lp seeds based on:
     * 1: the average grown stalk per bdv per season.
     * 2: the beanToMaxLpRatio.
     * @dev Given season < catchup season, the averageGrownStalkPerBdvPerSeason is static. See {test_avgGrownStalkPerBdv_changes}
     */
    function testDistroGaugeBeanToLp(
        uint256 beanToMaxLpRatio,
        uint256 avgGsPerBdvPerSeason
    ) public {
        address wellToken = initBeanToLp();
        // bound beanToMaxLpRatio.
        beanToMaxLpRatio = bound(beanToMaxLpRatio, 0, 100e18);
        // bound averageGrownStalkPerBdvPerSeason to reasonable values.
        // note: the bounds are limited by the ∆ seeds between seasons (cannot exceed int24.max, ~8 seeds).
        avgGsPerBdvPerSeason = bound(avgGsPerBdvPerSeason, 3e6, 10e6);

        // set values.
        bs.mockSetAverageGrownStalkPerBdvPerSeason(uint128(avgGsPerBdvPerSeason));
        bs.setBeanToMaxLpGpPerBdvRatio(uint128(beanToMaxLpRatio));

        // init values:
        IMockFBeanstalk.AssetSettings memory lpSettings = bs.tokenSettings(wellToken);
        // step gauge:
        bs.mockStepGauge();

        // assertions.
        IMockFBeanstalk.AssetSettings memory postBeanSettings = bs.tokenSettings(C.BEAN);
        IMockFBeanstalk.AssetSettings memory postLpSettings = bs.tokenSettings(wellToken);

        // verify that the gauge points remain unchanged.
        assertEq(
            uint256(postLpSettings.gaugePoints),
            uint256(lpSettings.gaugePoints),
            "invalid lp gauge points"
        );

        // verify bean seeds never exceed lp seeds.
        assertGe(
            uint256(postLpSettings.stalkEarnedPerSeason),
            uint256(postBeanSettings.stalkEarnedPerSeason),
            "bean seeds > lp seeds"
        );

        // verify that the bean seeds are adjusted based on the beanToMaxLpRatio.
        uint256 calcBeanToLpRatio = (uint256(postBeanSettings.stalkEarnedPerSeason) * 100e18) /
            postLpSettings.stalkEarnedPerSeason;
        uint256 targetRatio = bs.getBeanToMaxLpGpPerBdvRatioScaled();

        // precise within 1e-6%.
        assertApproxEqRel(calcBeanToLpRatio, targetRatio, 1e12);

        // verify that the seeds were properly calculated.
        // bean bdv * bean seeds + LP bdv * LP seeds = total stalk Issued this season.
        // total Stalk issued = averageGrownStalkPerBdvPerSeason * total bdv.
        uint256 beanBDV = bs.getTotalDepositedBdv(C.BEAN);
        uint256 lpBDV = bs.getTotalDepositedBdv(wellToken);
        uint256 totalBdv = beanBDV + lpBDV;
        uint256 beanStalk = beanBDV * postBeanSettings.stalkEarnedPerSeason;
        uint256 lpStalk = lpBDV * postLpSettings.stalkEarnedPerSeason;
        uint256 totalStalk = beanStalk + lpStalk;
        // precise within 1e-12%.
        assertApproxEqRel(
            totalStalk,
            totalBdv * avgGsPerBdvPerSeason,
            1e12,
            "invalid distrubution"
        );

        // rounding should occur such that totalBdv * avgGsPerBdvPerSeason > totalStalk.
        assertLe(totalStalk, totalBdv * avgGsPerBdvPerSeason, "calcTotalStalk > totalStalk");
    }

    ////////////////////// BEAN <> N LP GAUGE //////////////////////

    /**
     * When beanstalk has N LP token whitelisted, beanstalk adjusts the seeds between
     * N LP based on the % of gauge points.
     * the gauge points of each LP token is adjusted based on:
     * 1: the optimal % of deposited BDV.
     * 2: the target % of deposited BDV.
     * note: beanToMaxLPRatio and averageGrownStalkPerBdvPerSeason are kept constant for testing purposes.
     * see {testDistroGaugeBeanToLp} to see how the beanToMaxLPRatio and averageGrownStalkPerBdvPerSeason are adjusted.
     */
    function testDistroGaugeLpToLp() public {
        initLpToLpDistro();
        bs.mockStepGauge();

        // get silo settings.
        address[] memory tokens = bs.getWhitelistedTokens();
        IMockFBeanstalk.AssetSettings[] memory postSettings = new IMockFBeanstalk.AssetSettings[](
            tokens.length
        );

        // get data for assertions.
        uint256 totalGaugePoints;
        uint256 totalDepositedBdv;
        uint256 beanSeeds;
        uint256 largestLpSeeds;
        uint256 largestGpPerBdv;
        for (uint i; i < tokens.length; i++) {
            if (tokens[i] == C.UNRIPE_BEAN || tokens[i] == C.UNRIPE_LP) continue;
            postSettings[i] = bs.tokenSettings(tokens[i]);
            totalDepositedBdv += bs.getTotalDepositedBdv(tokens[i]);

            if (tokens[i] == C.BEAN) {
                beanSeeds = postSettings[i].stalkEarnedPerSeason;
                continue;
            } else {
                uint256 gpPerBdv = bs.getGaugePointsPerBdvForWell(tokens[i]);
                uint256 stalkEarnedPerSeason = postSettings[i].stalkEarnedPerSeason;
                totalGaugePoints += postSettings[i].gaugePoints;

                if (gpPerBdv > largestGpPerBdv) {
                    largestGpPerBdv = gpPerBdv;
                }

                if (stalkEarnedPerSeason > largestLpSeeds) {
                    largestLpSeeds = stalkEarnedPerSeason;
                }
            }
        }
        uint256 beanGpPerBdv = (largestGpPerBdv * bs.getBeanToMaxLpGpPerBdvRatioScaled()) / 100e18;
        totalGaugePoints += (bs.getTotalDepositedBdv(C.BEAN) * beanGpPerBdv) / 1e6;

        // assertions.

        // verify bean seeds never exceed the largest lp seeds.
        assertGe(largestLpSeeds, beanSeeds);

        // verify that stalk issued to LP is porportional to gauge point %.
        uint256 avgGrownStalkPerBdvPerSeason = bs.getAverageGrownStalkPerBdvPerSeason();
        uint256 totalStalk = totalDepositedBdv * avgGrownStalkPerBdvPerSeason;
        for (uint i; i < tokens.length; i++) {
            if (tokens[i] == C.BEAN) continue;
            uint256 percentGaugePoints = (postSettings[i].gaugePoints * 1e18) / totalGaugePoints;
            uint256 tokenDepositedBdv = bs.getTotalDepositedBdv(tokens[i]);
            uint256 stalkToLp = postSettings[i].stalkEarnedPerSeason * tokenDepositedBdv;
            // precise within 1e-6.
            assertApproxEqRel(stalkToLp, (totalStalk * percentGaugePoints) / 1e18, 1e12);
        }
    }

    ////////////////////// GAUGE HELPERS //////////////////////

    function addLiquidityAndReturnNonBeanValue(
        address well,
        uint256 nonBeanAmount
    ) internal returns (uint256 newTotalNonBeanValue) {
        (, address nonBeanToken) = addLiquidityToWellAtCurrentPrice(well, nonBeanAmount);
        uint256 usdTokenPrice = usdOracle.getUsdTokenPrice(nonBeanToken);
        uint256 precision = 10 ** MockToken(nonBeanToken).decimals();
        newTotalNonBeanValue = (nonBeanAmount * precision) / usdTokenPrice;
    }

    /**
     * @notice initializes state for locked beans. mints unripe beans and LP.
     * increments fertilizer.
     */
    function initializeLockedBeans() internal {
        // enable fertilizer, set 10k sprouts unfertilized:
        bs.setFertilizerE(true, 10000e6);

        // mint 20m unripe beans, add 2m underlying.
        addUnderlyingToUnripeBean(20000000e6, 2000000e6);
        // mint 20m unripe LP, add 20m beans worth of underlying:
        addUnderlyingToUnripeLP(20000000e6, 2000000e6);

        // set s.recapitalized to 100, and 1000 sprouts fertilized:
        bs.setPenaltyParams(100e6, 1000e6);
    }

    function addUnderlyingToUnripeBean(
        uint256 unripeAmount,
        uint256 beanAmount
    ) internal prank(users[0]) {
        MockToken(C.UNRIPE_BEAN).mint(users[0], unripeAmount);
        C.bean().mint(users[0], beanAmount);
        C.bean().approve(BEANSTALK, beanAmount);
        bs.addUnderlying(C.UNRIPE_BEAN, beanAmount);
    }

    function addUnderlyingToUnripeLP(
        uint256 unripeAmount,
        uint256 beanAmount
    ) internal prank(users[0]) {
        MockToken(C.UNRIPE_LP).mint(users[0], unripeAmount);
        address underlyingToken = bs.getUnderlyingToken(C.UNRIPE_LP);
        uint256 lpOut = addLiquidityToWell(underlyingToken, beanAmount, 20000 ether);

        MockToken(underlyingToken).approve(BEANSTALK, type(uint256).max);
        bs.addUnderlying(C.UNRIPE_LP, lpOut);
    }

    function burnBeansAndCheckLockedBeans(
        uint256 beansBurned
    ) internal returns (uint256 lockedBeansPercent) {
        uint256 lockedBeans = bs.getLockedBeansUnderlyingUnripeBean();
        vm.prank(users[0]);
        MockToken(C.UNRIPE_BEAN).burn(beansBurned);
        // a lower supply increases the amount of beans that are locked.
        uint256 newLockedBeans = bs.getLockedBeansUnderlyingUnripeBean();
        lockedBeansPercent = (newLockedBeans * 1e18) / bs.getTotalUnderlying(C.UNRIPE_BEAN);
        assertGe(newLockedBeans, lockedBeans);
        // 1e-12% precision.
    }

    /**
     * @notice initializes bean to lp tests.
     * @dev dewhitelists all wells but the first well (At time of testing, the bean Eth well).
     */
    function initBeanToLp() internal returns (address wellToken) {
        address[] memory whitelistedWells = bs.getWhitelistedWellLpTokens();
        for (uint i; i < whitelistedWells.length; i++) {
            if (i == 0) {
                wellToken = whitelistedWells[i];
                continue;
            }
            vm.prank(BEANSTALK);
            bs.dewhitelistToken(whitelistedWells[i]);
        }

        // add liquidity.
        addLiquidityToWellAtCurrentPrice(wellToken, 1000 ether);

        // deposit beans. (1000 bdv)
        depositForUser(users[1], C.BEAN, 1000e6);

        // deposit 1 ETH of LP (~2000 bdv)
        depositForUser(users[1], wellToken, 1e18);

        // skip germination, as germinating bdv is not included.
        bs.siloSunrise(0);
        bs.siloSunrise(0);
    }

    /**
     * @notice initializes the LP<>LP distrubution.
     * @dev the function updates the gaugePointSelector to a gauge point implementation
     * that stays constant for testing purposes.
     */
    function initLpToLpDistro() internal {
        address[] memory whitelistedWells = bs.getWhitelistedWellLpTokens();

        for (uint i; i < whitelistedWells.length; i++) {
            vm.prank(BEANSTALK);
            bytes4 gpSelector = bs.gaugePointsNoChange.selector;
            bytes4 lwSelector = bs.maxWeight.selector;
            bs.updateGaugeForToken(
                whitelistedWells[i],
                gpSelector,
                lwSelector,
                100e6 // unused.
            );

            addLiquidityToWellAtCurrentPrice(whitelistedWells[i], 1000 ether);

            // deposit 1 ETH of LP (~2000 bdv)
            depositForUser(users[1], whitelistedWells[i], 1e18);
        }

        // deposit beans. (1000 bdv)
        depositForUser(users[1], C.BEAN, 1000e6);

        // skip germination, as germinating bdv is not included.
        bs.siloSunrise(0);
        bs.siloSunrise(0);
    }

    /**
     * @notice validates that the seed gauge settings in storage changes.
     */
    function testSeedGaugeSettings() external {
        // validate current settings
        IMockFBeanstalk.SeedGaugeSettings memory seedGauge = bs.getSeedGaugeSetting();

        // change settings
        vm.prank(BEANSTALK);
        bs.updateSeedGaugeSettings(
            IMockFBeanstalk.SeedGaugeSettings(uint256(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        );

        IMockFBeanstalk.SeedGaugeSettings memory ssg = bs.getSeedGaugeSetting();
        assertEq(ssg.maxBeanMaxLpGpPerBdvRatio, 0);
        assertEq(ssg.minBeanMaxLpGpPerBdvRatio, 0);
        assertEq(ssg.targetSeasonsToCatchUp, 0);
        assertEq(ssg.podRateLowerBound, 0);
        assertEq(ssg.podRateOptimal, 0);
        assertEq(ssg.podRateUpperBound, 0);
        assertEq(ssg.deltaPodDemandLowerBound, 0);
        assertEq(ssg.deltaPodDemandUpperBound, 0);
        assertEq(ssg.lpToSupplyRatioUpperBound, 0);
        assertEq(ssg.lpToSupplyRatioOptimal, 0);
        assertEq(ssg.lpToSupplyRatioLowerBound, 0);
        assertEq(ssg.excessivePriceThreshold, 0);
    }
}
