// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {MockFieldFacet} from "contracts/mocks/mockFacets/MockFieldFacet.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {C} from "contracts/C.sol";

contract FieldTest is TestHelper {
    // events
    event Harvest(address indexed account, uint256 fieldId, uint256[] plots, uint256 beans);
    event Sow(address indexed account, uint256 fieldId, uint256 index, uint256 beans, uint256 pods);

    // Interfaces.
    MockFieldFacet field = MockFieldFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    // test accounts
    address[] farmers;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // initalize farmers from farmers (farmer0 == diamond deployer)
        farmers.push(users[1]);
        farmers.push(users[2]);

        // max approve.
        maxApproveBeanstalk(farmers);
    }

    //////////////// REVERTS ////////////////

    /**
     * farmer cannot sow if there is no soil.
     */
    function test_sowNoSoil(uint256 beans) public {
        beans = bound(beans, 1, type(uint256).max);
        // issue `beans` to farmers
        C.bean().mint(farmers[0], beans);
        vm.prank(farmers[0]);
        vm.expectRevert("Field: Soil Slippage");
        field.sow(
            beans, // amt
            1, // min temperature
            LibTransfer.From.EXTERNAL
        );
    }

    /**
     * @notice min soil cannot be greater than soil.
     */
    function test_sowSoilBelowMinSoil(uint256 beans, uint256 soil) public {
        beans = bound(beans, 2, type(uint128).max); // soil casted to uint128.
        soil = bound(soil, 1, beans - 1); // beans less than soil.

        // issue `beans` to farmers
        C.bean().mint(farmers[0], beans);
        season.setSoilE(soil - 1);
        vm.prank(farmers[0]);
        vm.expectRevert("Field: Soil Slippage");
        field.sowWithMin(
            beans, // amt
            1, // min temperature
            soil, // min soil
            LibTransfer.From.EXTERNAL
        );
    }

    /**
     * @notice `beans` cannot be lower than `minSoil`.
     */
    function test_sowBeansBelowMinSoil(uint256 beans, uint256 soil) public {
        soil = bound(soil, 1, type(uint128).max); // soil casted to uint128.
        beans = bound(beans, 0, soil - 1); // beans less than soil.

        // issue `beans` to farmers
        C.bean().mint(farmers[0], beans);
        vm.prank(farmers[0]);
        vm.expectRevert("Field: Soil Slippage");
        field.sowWithMin(
            beans, // amt
            1, // min temperature
            soil, // min soil
            LibTransfer.From.EXTERNAL
        );
    }

    /**
     * @notice tests that farmer can sow all the soil.
     * Checks state after sowing.
     * @param from 0 = external, 1 = internal
     */
    function testSowAllSoil(uint256 soil, bool from) public {
        soil = bound(soil, 100, type(uint128).max);

        C.bean().mint(farmers[0], soil);

        uint256 beanBalanceBefore = bs.getBalance(farmers[0], C.BEAN);
        uint256 totalBeanSupplyBefore = C.bean().totalSupply();

        if (from) {
            // if internal, transferToken to internal balances.
            vm.prank(farmers[0]);
            bs.transferToken(C.BEAN, farmers[0], soil, 0, 1);
        }

        _beforeEachSow(soil, soil, from == true ? 1 : 0);
        sowAssertEq(farmers[0], beanBalanceBefore, totalBeanSupplyBefore, soil, (soil * 101) / 100);
        assertEq(field.totalSoil(), 0, "total Soil");
    }

    /**
     * @notice verify that farmer can correctly sows a portion of soil.
     * @param from 0 = external, 1 = internal
     */
    function test_SowSoil(uint256 beansToSow, uint256 soil, bool from) public {
        soil = bound(soil, 100, type(uint128).max); // soil casted to uint128.
        beansToSow = bound(beansToSow, 0, soil); // bounded by soil.
        C.bean().mint(farmers[0], beansToSow);

        if (from) {
            // if internal, transferToken to internal balances.
            vm.prank(farmers[0]);
            bs.transferToken(C.BEAN, farmers[0], beansToSow, 0, 1);
        }

        uint256 beanBalanceBefore = bs.getBalance(farmers[0], C.BEAN);
        uint256 totalBeanSupplyBefore = C.bean().totalSupply();

        _beforeEachSow(soil, beansToSow, from == true ? 1 : 0);
        sowAssertEq(
            farmers[0],
            beanBalanceBefore,
            totalBeanSupplyBefore,
            beansToSow,
            (beansToSow * 101) / 100
        );
        assertEq(uint256(field.totalSoil()), soil - beansToSow, "total Soil");
    }

    /**
     * sow soil from internal tolerant mode.
     * @dev internal tolerant will receive tokens
     * from the farmer's Internal Balance and will not fail
     * if there is not enough in their Internal Balance.
     */
    function test_SowSoilFromInternalTolerant(
        uint256 beansToSow,
        uint256 soil,
        uint256 beansToInternal
    ) public {
        soil = bound(soil, 100, type(uint128).max); // soil casted to uint128.
        beansToSow = bound(beansToSow, 1, soil); // bounded by soil.
        beansToInternal = bound(beansToInternal, 1, beansToSow); // internal beans < beansToSow
        C.bean().mint(farmers[0], beansToInternal);

        vm.prank(farmers[0]);

        // transfer to their internal balance.
        bs.transferToken(C.BEAN, farmers[0], beansToInternal, 0, 1);
        uint256 beanBalanceBefore = bs.getBalance(farmers[0], C.BEAN);
        uint256 totalBeanSupplyBefore = C.bean().totalSupply();

        _beforeEachSowInternalTolerant(soil, beansToSow, beansToInternal);
        if (beansToSow > beansToInternal) beansToSow = beansToInternal;
        sowAssertEq(
            farmers[0],
            beanBalanceBefore,
            totalBeanSupplyBefore,
            beansToSow,
            (beansToSow * 101) / 100
        );
        assertEq(field.totalSoil(), soil - beansToSow, "total Soil");
    }

    /**
     * in cases where a farmer wants to sow more beans than soil available,
     * beanstalk introduces a `minSoil` parameter, which allows the farmer to
     * specify the minimum amount of soil they are willing to sow.
     */
    function testSowMin(uint256 minSoil, uint256 beans) public prank(farmers[0]) {
        // bound variables s.sys.t beans >= amount
        minSoil = bound(minSoil, 100, type(uint128).max);
        beans = bound(beans, minSoil, type(uint128).max);
        C.bean().mint(farmers[0], beans);

        uint256 beanBalanceBefore = C.bean().balanceOf(farmers[0]);
        uint256 totalBeanSupplyBefore = C.bean().totalSupply();

        bs.setSoilE(minSoil);
        field.sowWithMin(
            beans, // amount to sow
            0, // min.t
            0, // farmer is willing to min any amount of soil.
            LibTransfer.From.EXTERNAL
        );

        uint256 amountSown = beans > minSoil ? minSoil : beans;

        sowAssertEq(
            farmers[0],
            beanBalanceBefore,
            totalBeanSupplyBefore,
            amountSown,
            (amountSown * 101) / 100
        );

        assertEq(field.totalSoil(), 0);
    }

    /**
     * test ensures that multiple sows correctly
     * updates plot index, total pods, and total soil.
     */
    function testSowFrom2farmers(
        uint256 soilAvailable,
        uint256 farmer1Sow,
        uint256 farmer2Sow
    ) public {
        soilAvailable = bound(soilAvailable, 0, type(uint128).max);
        farmer1Sow = bound(farmer1Sow, 0, soilAvailable / 2);
        farmer2Sow = bound(farmer2Sow, 0, soilAvailable / 2);
        uint256 farmer1BeansBeforeSow;
        uint256 farmer2BeansBeforeSow;

        (
            farmer1Sow,
            farmer2Sow,
            farmer1BeansBeforeSow,
            farmer2BeansBeforeSow
        ) = beforeEachSow2farmers(soilAvailable, farmers[0], farmer1Sow, farmers[1], farmer2Sow);

        uint256 totalAmountSown = farmer1Sow + farmer2Sow;
        uint256 farmer1Pods = (farmer1Sow * 101) / 100;
        uint256 farmer2Pods = (farmer2Sow * 101) / 100;
        uint256 totalPodsIssued = farmer1Pods + farmer2Pods;

        assertEq(
            C.bean().balanceOf(farmers[0]),
            farmer1BeansBeforeSow - farmer1Sow,
            "farmer 1 invalid balance"
        );
        assertEq(field.plot(farmers[0], 0, 0), farmer1Pods, "farmer 1 invalid pods");

        assertEq(
            C.bean().balanceOf(farmers[1]),
            farmer2BeansBeforeSow - farmer2Sow,
            "farmer 2 invalid balance"
        );
        assertEq(field.plot(farmers[1], 0, farmer1Pods), farmer2Pods, "farmer 2 invalid pods");
        assertEq(
            C.bean().totalSupply(),
            farmer1BeansBeforeSow + farmer2BeansBeforeSow - totalAmountSown,
            "invalid bean supply"
        );
        assertEq(C.bean().balanceOf(BEANSTALK), 0, "beans remaining in beanstalk");

        assertEq(field.totalPods(0), totalPodsIssued, "invalid total pods");
        assertEq(field.totalUnharvestable(0), totalPodsIssued, "invalid unharvestable");
        assertEq(field.podIndex(0), totalPodsIssued, "invalid pod index");

        assertEq(field.totalSoil(), soilAvailable - totalAmountSown);
    }

    /**
     * checking next sow time, with more than 1 soil available
     * *after* sowing.
     * @dev Does not set thisSowTime if Soil > 1;
     */
    function testComplexDPDMoreThan1Soil(uint256 initalSoil, uint256 farmerSown) public {
        initalSoil = bound(initalSoil, 2e6, type(uint128).max);
        // sow such that at minimum, there is 1e6 + 1 soil left
        farmerSown = bound(farmerSown, 0, initalSoil - (1e6 + 1));
        bs.setSoilE(initalSoil);
        C.bean().mint(farmers[0], farmerSown);
        uint256 beans = C.bean().balanceOf(farmers[0]);

        vm.prank(farmers[0]);
        field.sow(beans, 0, LibTransfer.From.EXTERNAL);
        IMockFBeanstalk.Weather memory w = bs.weather();
        assertEq(uint256(w.thisSowTime), type(uint32).max);
    }

    function _beforeEachSow(uint256 soilAmount, uint256 sowAmount, uint8 from) public {
        vm.roll(30);
        season.setSoilE(soilAmount);
        vm.expectEmit();
        emit Sow(farmers[0], 0, 0, sowAmount, (sowAmount * 101) / 100);
        vm.prank(farmers[0]);
        if (from == 0) {
            field.sow(sowAmount, 0, LibTransfer.From.EXTERNAL);
        } else if (from == 1) {
            field.sow(sowAmount, 0, LibTransfer.From.INTERNAL);
        } else if (from == 3) {
            field.sow(sowAmount, 0, LibTransfer.From.INTERNAL_TOLERANT);
        }
    }

    /**
     * @notice INTERNAL_TOLERANT is a mode where will receive tokens from the
     * farmer's Internal Balance and will not fail if there is not enough in their Internal Balance.
     *
     * In this example, a farmer can input a balance larger than their internal balance, but beanstalk will only credit up to their internal balance.
     * This prevents reverts.
     */
    function _beforeEachSowInternalTolerant(
        uint256 soilAmount,
        uint256 sowAmount,
        uint256 internalBalance
    ) public {
        vm.roll(30);
        season.setSoilE(soilAmount);
        vm.expectEmit();
        if (internalBalance > sowAmount) internalBalance = sowAmount;
        emit Sow(farmers[0], 0, 0, internalBalance, (internalBalance * 101) / 100);
        vm.prank(farmers[0]);
        field.sow(sowAmount, 0, LibTransfer.From.INTERNAL_TOLERANT);
    }

    function beforeEachSow2farmers(
        uint256 soil,
        address farmer0,
        uint256 amount0,
        address farmer1,
        uint256 amount1
    ) public returns (uint256, uint256, uint256, uint256) {
        season.setSoilE(soil);
        C.bean().mint(farmer0, amount0);
        uint256 initalBeanBalance0 = C.bean().balanceOf(farmer0);
        if (amount0 > soil) amount0 = soil;
        soil -= amount0;

        vm.startPrank(farmer0);
        vm.expectEmit(true, true, true, true);
        emit Sow(farmer0, 0, 0, amount0, (amount0 * 101) / 100);
        field.sowWithMin(amount0, 0, 0, LibTransfer.From.EXTERNAL);
        vm.stopPrank();

        C.bean().mint(farmer1, amount1);
        uint256 initalBeanBalance1 = C.bean().balanceOf(farmer1);
        if (amount1 > soil) amount1 = soil;
        soil -= amount1;

        vm.startPrank(farmer1);
        vm.expectEmit(true, true, true, true);
        emit Sow(farmer1, 0, (amount0 * 101) / 100, amount1, (amount1 * 101) / 100);
        field.sowWithMin(amount1, 0, 0, LibTransfer.From.EXTERNAL);
        vm.stopPrank();

        return (amount0, amount1, initalBeanBalance0, initalBeanBalance1);
    }

    // // helper function to reduce clutter, asserts that the state of the field is as expected
    function sowAssertEq(
        address account,
        uint256 preBeanBalance,
        uint256 preTotalBalance,
        uint256 sowedAmount,
        uint256 expectedPods
    ) public view {
        assertEq(bs.getBalance(account, C.BEAN), preBeanBalance - sowedAmount, "balanceOf");
        assertEq(C.bean().balanceOf(BEANSTALK), 0, "field balanceOf");
        assertEq(C.bean().totalSupply(), preTotalBalance - sowedAmount, "total supply");

        //// FIELD STATE ////
        assertEq(field.plot(account, 0, 0), expectedPods, "plot");
        assertEq(field.totalPods(0), expectedPods, "total Pods");
        assertEq(field.totalUnharvestable(0), expectedPods, "totalUnharvestable");
        assertEq(field.podIndex(0), expectedPods, "podIndex");
        assertEq(field.harvestableIndex(0), 0, "harvestableIndex");
    }

    /**
     * @notice verfies that a farmer's plot index is updated correctly.
     * @dev partial harvests and transfers are tested here. full harvests/transfers can be seen in `test_plotIndexMultiple`.
     */
    function test_plotIndexList(uint256 sowAmount, uint256 portion) public {
        uint256 activeField = field.activeField();
        uint256[] memory plotIndexes = field.getPlotIndexesFromAccount(farmers[0], activeField);
        MockFieldFacet.Plot[] memory plots = field.getPlotsFromAccount(farmers[0], activeField);
        assertEq(plotIndexes.length, plots.length, "plotIndexes length");
        assertEq(plotIndexes.length, 0, "plotIndexes length");

        sowAmount = bound(sowAmount, 100, type(uint128).max);
        uint256 pods = (sowAmount * 101) / 100;
        portion = bound(portion, 1, pods - 1);
        field.incrementTotalHarvestableE(activeField, portion);
        sowAmountForFarmer(farmers[0], sowAmount);

        plotIndexes = field.getPlotIndexesFromAccount(farmers[0], activeField);
        plots = field.getPlotsFromAccount(farmers[0], activeField);
        assertEq(plotIndexes.length, plots.length, "plotIndexes length");
        assertEq(plotIndexes.length, 1, "plotIndexes length");
        assertEq(plots[0].index, 0, "plotIndexes[0]");
        assertEq(plots[0].pods, pods, "plotIndexes[0]");

        uint256 snapshot = vm.snapshot();

        // transfer a portion of the plot.

        vm.prank(farmers[0]);
        bs.transferPlot(farmers[0], farmers[1], activeField, 0, 0, portion);

        // verify sender plot index.
        plotIndexes = field.getPlotIndexesFromAccount(farmers[0], activeField);
        plots = field.getPlotsFromAccount(farmers[0], activeField);
        assertEq(plotIndexes.length, plots.length, "plotIndexes length");
        assertEq(plotIndexes.length, 1, "plotIndexes length");
        assertEq(plots[0].index, portion, "plotIndexes[0]");
        assertEq(plots[0].pods, pods - portion, "plotIndexes[0]");

        // verify receiver plot index.
        plotIndexes = field.getPlotIndexesFromAccount(farmers[1], activeField);
        plots = field.getPlotsFromAccount(farmers[1], activeField);
        assertEq(plotIndexes.length, plots.length, "plotIndexes length");
        assertEq(plotIndexes.length, 1, "plotIndexes length");
        assertEq(plots[0].index, 0, "plotIndexes[0]");
        assertEq(plots[0].pods, portion, "plotIndexes[0]");

        // revert to snapshot, harvest portion of plot.
        vm.revertTo(snapshot);

        plotIndexes = field.getPlotIndexesFromAccount(farmers[0], activeField);
        vm.prank(farmers[0]);
        field.harvest(activeField, plotIndexes, LibTransfer.To.EXTERNAL);

        plotIndexes = field.getPlotIndexesFromAccount(farmers[0], activeField);
        plots = field.getPlotsFromAccount(farmers[0], activeField);
        assertEq(plotIndexes.length, plots.length, "plotIndexes length");
        assertEq(plotIndexes.length, 1, "plotIndexes length");
        assertEq(plots[0].index, portion, "plotIndexes[0]");
        assertEq(plots[0].pods, pods - portion, "plotIndexes[0]");
    }

    /**
     * @notice performs a series of actions to verify sows multiple times and verifies that the plot index is updated correctly.
     * 1. sowing properly increments the plot index.
     * 2. transfering a plot properly decrements the senders' plot index,
     * and increments the recipients' plot index.
     * 3. harvesting a plot properly decrements the senders' plot index.
     */
    function test_plotIndexMultiple() public {
        uint256 activeField = field.activeField();
        //////////// SOWING ////////////

        uint256 sowAmount = rand(0, 10e6);
        uint256 sows = rand(1, 1000);
        for (uint256 i; i < sows; i++) {
            sowAmountForFarmer(farmers[0], sowAmount);
        }
        verifyPlotIndexAndPlotLengths(farmers[0], sows);
        uint256 pods = (sowAmount * 101) / 100;
        MockFieldFacet.Plot[] memory plots = field.getPlotsFromAccount(farmers[0], activeField);
        for (uint256 i; i < sows; i++) {
            assertEq(plots[i].index, i * pods, "plotIndexes");
            assertEq(plots[i].pods, pods, "plotIndexes");
        }

        //////////// TRANSFER ////////////

        // transfers a random amount of plots to farmer[1].
        uint256 transfers = rand(1, ((sows - 1) / 2) + 1);

        uint256[] memory plotIndexes = field.getPlotIndexesFromAccount(farmers[0], activeField);
        assembly {
            mstore(plotIndexes, transfers)
        }
        uint256[] memory ends = new uint256[](transfers);

        for (uint256 i; i < transfers; i++) {
            ends[i] = pods;
        }

        vm.startPrank(farmers[0]);
        bs.transferPlots(
            farmers[0],
            farmers[1],
            activeField,
            plotIndexes,
            new uint256[](transfers),
            ends
        );
        vm.stopPrank();
        verifyPlotIndexAndPlotLengths(farmers[0], sows - transfers);

        // upon a transfer/burn, the list of plots are not ordered.
        plots = field.getPlotsFromAccount(farmers[0], activeField);
        for (uint i; i < plots.length; i++) {
            assertTrue(plots[i].index % pods == 0);
            assertEq(plots[i].pods, pods, "pods");
        }

        verifyPlotIndexAndPlotLengths(farmers[1], transfers);

        plots = field.getPlotsFromAccount(farmers[1], activeField);
        for (uint i; i < plots.length; i++) {
            assertTrue(plots[i].index % pods == 0);
            assertEq(plots[i].pods, pods, "pods");
        }

        //////////// HARVESTING ////////////

        // verify that a user is able to harvest all plots from calling their `getPlotIndexesFromAccount`
        // assuming all valid indexes are returned.
        field.incrementTotalHarvestableE(field.activeField(), 1000 * pods);

        uint256[] memory accountPlots = field.getPlotIndexesFromAccount(farmers[0], activeField);
        vm.prank(farmers[0]);
        field.harvest(activeField, accountPlots, LibTransfer.To.EXTERNAL);
        verifyPlotIndexAndPlotLengths(farmers[0], 0);
        // verify that plots are empty.
        plots = field.getPlotsFromAccount(farmers[0], activeField);

        accountPlots = field.getPlotIndexesFromAccount(farmers[1], activeField);
        vm.prank(farmers[1]);
        field.harvest(activeField, accountPlots, LibTransfer.To.EXTERNAL);
        // verify that plots are empty.
        verifyPlotIndexAndPlotLengths(farmers[1], 0);
    }

    // field helpers.

    /**
     * @notice mints `sowAmount` beans for farmer,
     * issues `sowAmount` of beans to farmer.
     * sows `sowAmount` of beans.
     */
    function sowAmountForFarmer(address farmer, uint256 sowAmount) internal {
        season.setSoilE(sowAmount);
        mintTokensToUser(farmer, C.BEAN, sowAmount);
        vm.prank(farmer);
        field.sow(sowAmount, 0, LibTransfer.From.EXTERNAL);
    }

    function verifyPlotIndexAndPlotLengths(address farmer, uint256 expectedLength) public view {
        uint256 fieldId = field.activeField();
        uint256[] memory plotIndexes = field.getPlotIndexesFromAccount(farmer, fieldId);
        MockFieldFacet.Plot[] memory plots = field.getPlotsFromAccount(farmer, fieldId);
        assertEq(plotIndexes.length, plots.length, "plotIndexes length");
        assertEq(plotIndexes.length, expectedLength, "plotIndexes length");
    }
}
