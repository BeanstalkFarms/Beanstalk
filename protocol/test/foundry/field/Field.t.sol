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

    // /**
    //  * checking next sow time, with exactly 0 soil available
    //  * *after* sowing.
    //  */
    // function testComplexDPD1Soil() public {
    //     // Does set thisSowTime if Soil = 1;
    //     season.setSoilE(1e6);
    //     vm.prank(brean);
    //     field.sow(1e6, 1, LibTransfer.From.EXTERNAL);
    //     weather = season.weather();
    //     assertLt(uint256(weather.thisSowTime), uint256(LibConstant.MAX_UINT32));
    // }

    // /**
    //  * checking next sow time, with less than 1 soil available
    //  * *after* sowing.
    //  */
    // function testComplexDPDLessThan1Soil() public {
    //     // Does set thisSowTime if Soil < 1;
    //     season.setSoilE(1.5e6);
    //     vm.prank(brean);
    //     field.sow(1 * 1e6, 1, LibTransfer.From.EXTERNAL);
    //     weather = season.weather();
    //     assertLt(uint256(weather.thisSowTime), uint256(LibConstant.MAX_UINT32));
    // }

    // /**
    //  * checking next sow time with less than 1 soil available,
    //  * after it has been set previously in the season.
    //  * *after* sowing.
    //  */
    // function testComplexDPDLessThan1SoilNoSet() public {
    //     // Does not set thisSowTime if Soil already < 1;
    //     season.setSoilE(1.5e6);
    //     vm.prank(brean);
    //     field.sow(1e6, 1, LibTransfer.From.EXTERNAL);
    //     weather = season.weather();
    //     vm.prank(siloChad);
    //     field.sow(0.5e6, 1, LibTransfer.From.EXTERNAL);
    //     System.Weather memory weather2 = season.weather();
    //     assertEq(uint256(weather2.thisSowTime), uint256(weather.thisSowTime));
    // }

    // // a farmer cannot harvest another farmers plot, or an unintialized plot.
    // function testCannotHarvestUnownedPlot() public {
    //     _beforeEachHarvest();
    //     field.incrementTotalHarvestableE(101e6);
    //     uint256[] memory harvestPlot = new uint[](1);
    //     harvestPlot[0] = 0;
    //     vm.prank(siloChad);
    //     vm.expectRevert("Field: no plot");
    //     field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
    // }

    // /**
    //  * a farmer cannot harvest an unharvestable plot.
    //  * a plot is unharvestable if the index of plot > s.sys.field[].harvestable.
    //  */
    // function testCannotHarvestUnharvestablePlot() public {
    //     _beforeEachHarvest();
    //     uint256[] memory harvestPlot = new uint[](1);
    //     harvestPlot[0] = 0;
    //     vm.prank(brean);
    //     vm.expectRevert("Field: Plot not Harvestable");
    //     field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
    // }

    // // test that a farmer can harvest an entire plot.
    // function testHarvestEntirePlot() public {
    //     uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    //     uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    //     _beforeEachHarvest();
    //     _beforeEachFullHarvest();
    //     //updates farmer balance
    //     assertEq(C.bean().balanceOf(brean), beanBalanceBefore + 1e6);
    //     assertEq(field.plot(brean, 0), 0);

    //     //updates total balance
    //     assertEq(C.bean().balanceOf(BEANSTALK), 0);
    //     assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6 + 1e6);
    //     assertEq(field.totalPods(), 101e6);
    //     assertEq(uint256(field.totalSoil()), 0);
    //     assertEq(field.totalUnharvestable(), 101e6);
    //     assertEq(field.totalHarvestable(), 0);
    //     assertEq(field.harvestableIndex(), 101e6);
    //     assertEq(field.totalHarvested(), 101e6);
    //     assertEq(field.podIndex(), 202e6);
    // }

    // // test that a farmer can harvest an partial plot.
    // function testHarvestPartialPlot() public {
    //     uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    //     uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    //     _beforeEachHarvest();
    //     _beforeEachPartialHarvest();
    //     //updates farmer balance
    //     assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 50e6);
    //     assertEq(field.plot(brean, 0), 0);
    //     assertEq(field.plot(brean, 50e6), 51e6);

    //     //updates total balance
    //     assertEq(C.bean().balanceOf(BEANSTALK), 0);
    //     assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 200e6 + 50e6);
    //     assertEq(field.totalPods(), 152e6);
    //     assertEq(uint256(field.totalSoil()), 0);
    //     assertEq(field.totalUnharvestable(), 152e6);
    //     assertEq(field.totalHarvestable(), 0);
    //     assertEq(field.harvestableIndex(), 50e6);
    //     assertEq(field.totalHarvested(), 50e6);
    //     assertEq(field.podIndex(), 202e6);
    // }

    // // test that a farmer can harvest an entire plot, that is listed on the pod market.
    // function testHarvestEntirePlotWithListing() public {
    //     uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    //     uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    //     _beforeEachHarvest();
    //     _beforeEachHarvestEntirePlotWithListing();
    //     assertEq(C.bean().balanceOf(brean), beanBalanceBefore + 1e6);
    //     assertEq(field.plot(brean, 0), 0);
    //     assertEq(C.bean().balanceOf(BEANSTALK), 0, "Field balanceOf");
    //     assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6 + 1e6, "totalSupply");

    //     assertEq(field.totalPods(), 101e6, "totalPods");
    //     assertEq(uint256(field.totalSoil()), 0, "soil");
    //     assertEq(field.totalUnharvestable(), 101e6, "totalUnharvestable");
    //     assertEq(field.totalHarvestable(), 0, "totalHarvestable");
    //     assertEq(field.harvestableIndex(), 101e6, "harvestableIndex");
    //     assertEq(field.totalHarvested(), 101e6, "totalHarvested");
    //     assertEq(field.podIndex(), 202e6, "podIndex");

    //     //deletes
    //     assertEq(marketplace.getPodListing(0), 0);
    // }

    // //////////////////// MORNING AUCTION ////////////////////////////
    // /**
    //  * The morning auction is a mechanism that introduces
    //  * reflexivity to the temperature that beanstalk is willing to lend at.
    //  * During the first 25 blocks (5 minutes) of the season (dubbed the morning),
    //  * the temperature starts at 1% and increases logarithmically until it reaches
    //  * the maximum temperature.
    //  * The formula for the morning auction is:
    //  * max(temperature*log_a*b+1(a*c + 1),1) where:
    //  * a = 2,
    //  * b = 25 (length of morning auction)
    //  * c = number of blocks elapsed since the start of season.
    //  */
    // function testMorningAuctionValues(uint256 blockNo, uint32 _temperature) public {

    //     // tests that morning auction values align with manually calculated values
    //     _temperature = uint32(bound(uint256(_temperature), 1, 100_000_000)); // arbitary large number
    //     season.setMaxTempE(_temperature);
    //     blockNo = bound(blockNo, 1, 26); // 12s block time = 300 blocks in an season

    //     uint256[26] memory ScaleValues;
    //     ScaleValues = [
    //         uint256(1000000), // Delta = 0
    //         279415312704, // Delta = 1
    //         409336034395, // 2
    //         494912626048, // 3
    //         558830625409, // 4
    //         609868162219, // 5
    //         652355825780, // 6
    //         688751347100, // 7
    //         720584687295, // 8
    //         748873234524, // 9
    //         774327938752, // 10
    //         797465225780, // 11
    //         818672068791, // 12
    //         838245938114, // 13
    //         856420437864, // 14
    //         873382373802, // 15
    //         889283474924, // 16
    //         904248660443, // 17
    //         918382006208, // 18
    //         931771138485, // 19
    //         944490527707, // 20
    //         956603996980, // 21
    //         968166659804, // 22
    //         979226436102, // 23
    //         989825252096, // 24
    //         1000000000000 // 25
    //     ];

    //     vm.roll(blockNo);

    //     // temperature is scaled as such:
    //     // (1e2)    season.weather().t
    //     // (1e12)    * pct
    //     // (1e6)     / TEMPERATURE_PRECISION
    //     // (1e8)     = temperature
    //     uint256 __temperature = uint256(season.weather().t).mulDiv(ScaleValues[blockNo - 1], 1e6, UD60x18.Rounding.Up);
    //     // temperature is always 1% if a farmer sows at the same block
    //     // as the sunrise block, irregardless of temperature
    //     uint256 calcTemperature = blockNo == 1 ? 1e6 : max(__temperature, 1e6);
    //     assertApproxEqAbs(field.temperature(), calcTemperature, 0); // +/- 1 due to rounding
    //     assertEq(field.temperature(), calcTemperature);
    // }

    // // various sowing at different dutch auctions + different soil amount
    // // soil sown should be larger than starting soil
    // // pods issued should be the same maximum
    // function test_remainingPods_abovePeg(uint256 rand) prank(brean) public {
    //     _beforeEachMorningAuction();
    //     uint256 _block = 1;
    //     uint256 maxBeans = 10e6;
    //     uint256 totalSoilSown = 0;
    //     uint256 totalPodsMinted = 0;

    //     while (field.totalSoil() > 0) {
    //         vm.roll(_block);
    //         // we want to randomize the amount of soil sown,
    //         // but currently foundry does not support stateful fuzz testing.
    //         uint256 beans = uint256(keccak256(abi.encodePacked(rand))).mod(maxBeans);

    //         // if beans is less than maxBeans, then sow remaining instead
    //         if (maxBeans > field.totalSoil()){
    //             beans = field.totalSoil();
    //         }
    //         totalPodsMinted = totalPodsMinted + field.sow(beans, 1e6, LibTransfer.From.EXTERNAL);
    //         totalSoilSown = totalSoilSown + beans;
    //         _block++;
    //         rand++;
    //     }
    //     assertEq(field.totalPods(), field.totalUnharvestable(), "totalUnharvestable");
    //     assertEq(totalPodsMinted, field.totalPods(), "totalPodsMinted");
    //     assertEq(field.remainingPods(), 0, "remainingPods");
    //     assertGt(totalSoilSown, 100e6, "totalSoilSown");
    // }

    // // same test as above, but below peg
    // // soil sown should be equal to starting soil
    // // pods issued should be less than maximum
    // function test_remainingPods_belowPeg(uint256 rand) public prank(brean) {
    //     _beforeEachMorningAuctionBelowPeg();
    //     uint256 _block = 1; // start block
    //     uint256 totalSoilSown = 0;
    //     uint256 maxBeans = 5e6; // max beans that can be sown in a tx
    //     uint256 totalPodsMinted = 0;
    //     uint256 maxPods = 200e6; // maximum pods that should be issued
    //     uint256 initalBal = C.bean().balanceOf(brean); // inital balance

    //     while (field.totalSoil() > 0) {
    //         // we want to randomize the beans sown,
    //         // but currently foundry does not support stateful fuzz testing.
    //         uint256 beans = uint256(keccak256(abi.encodePacked(rand))).mod(maxBeans);
    //         vm.roll(_block);
    //         uint256 lastTotalSoil = field.totalSoil();
    //         // if beans is less than maxBeans, then sow remaining instead
    //         if (maxBeans > field.totalSoil()){
    //             beans = field.totalSoil();
    //         }
    //         totalSoilSown = totalSoilSown + beans;
    //         totalPodsMinted = totalPodsMinted + field.sow(beans, 1e6, LibTransfer.From.EXTERNAL);
    //         assertEq(lastTotalSoil - field.totalSoil(), beans);
    //         _block++;
    //         rand++;
    //     }
    //     assertLt(field.totalUnharvestable(), maxPods);
    //     assertEq(field.totalPods(), field.totalUnharvestable(), "totalUnharvestable");
    //     assertEq(totalPodsMinted, field.totalPods(), "totalPodsMinted");
    //     assertEq(field.remainingPods(), 0, "remainingPods is not 0");

    //     // check the amt of soil sown at the end of the season is equal to start soil
    //     assertEq(totalSoilSown, 100e6, "totalSoilSown");
    //     assertEq(
    //         totalSoilSown,
    //         initalBal - C.bean().balanceOf(brean),
    //         "total bean used does not equal total soil sown"
    //     );
    // }

    // // multiple fixed amount sows at different dutch auction times
    // function testRoundingErrorBelowPeg(uint256 beans) prank(brean) public {
    //     // we bound between 1 and 10 beans to sow, out of 100 total soil.
    //     beans = bound(beans, 1e6, 10e6);
    //     _beforeEachMorningAuction();
    //     uint256 _block = 1;
    //     uint256 totalSoilSown = 0;
    //     uint256 totalPodsMinted = 0;
    //     uint256 lastTotalSoil;
    //     while (field.totalSoil() > 0) {
    //         vm.roll(_block);
    //         lastTotalSoil = field.totalSoil();
    //         // if beans is less than the amount of soil in the field, then sow remaining instead
    //         if (beans > field.totalSoil()) beans = field.totalSoil();
    //         totalSoilSown = totalSoilSown + beans;
    //         totalPodsMinted = totalPodsMinted + field.sow(beans, 1e6, LibTransfer.From.EXTERNAL);

    //         // because totalsoil is scaled up,
    //         // it may cause the delta to be up to 2 off
    //         // (if one was rounded up, and the other is rounded down)
    //         assertApproxEqAbs(lastTotalSoil - field.totalSoil(), beans, 2);
    //         // cap the blocks between 1 - 25 blocks
    //         if (_block < 25) _block++;
    //     }

    //     assertEq(
    //         field.totalUnharvestable(),
    //         totalPodsMinted,
    //         "TotalUnharvestable doesn't equal totalPodsMinted"
    //     );
    //     // check the amount of beans sown at the end of the season is greater than the start soil
    //     assertGt(
    //         totalSoilSown,
    //         100e6,
    //         "Total soil sown is less than inital soil issued."
    //     );
    // }

    // /**
    //  * check that the Soil decreases over 25 blocks, then stays stagent
    //  * when beanstalk is above peg, the soil issued is now:
    //  * `availableSoil` = s.sys.soil * (1+ s.sys.weather.t)/(1+ yield())
    //  * `availableSoil` should always be greater or equal to s.sys.soil
    //  */
    // function testSoilDecrementsOverDutchAbovePeg(uint256 startingSoil) public {
    //     _beforeEachMorningAuction();
    //     // uint256 startingSoil = 100e6;
    //     startingSoil = bound(startingSoil, 100e6, 10000e6);
    //     season.setSoilE(startingSoil);
    //     startingSoil = startingSoil.mulDiv(200, 101);
    //     uint256 sfsoil = uint256(field.totalRealSoil());
    //     for (uint256 i = 1; i < 30; ++i) {
    //         vm.roll(i);
    //         uint256 LastSoil = uint256(field.totalSoil());
    //         if (i == 1) {
    //             // sunriseBlock is set at block 1;
    //             assertEq(LastSoil, startingSoil, "LastSoil");
    //         } else if (i <= 26) {
    //             assertGt(startingSoil, LastSoil);
    //             assertGt(startingSoil, sfsoil);
    //             startingSoil = LastSoil;
    //         } else {
    //             assertEq(startingSoil, LastSoil);
    //             assertEq(startingSoil, sfsoil);
    //             startingSoil = LastSoil;
    //         }
    //     }
    // }

    // /**
    //  * sowing all soil, with variable soil, temperature, and place in the morning auction.
    //  * this is done by rolling to a block between 1 and 25, and sowing all soil.
    //  * pods issued should always be equal to remainingPods.
    //  * soil/bean used should always be greater/equal to soil issued.
    //  */
    // function testSowAllMorningAuctionAbovePeg(uint256 soil, uint32 temperature, uint256 _block) public {
    //     sowAllInit(
    //         temperature,
    //         soil,
    //         _block,
    //         true
    //     );
    //     uint256 remainingPods = field.remainingPods();
    //     uint256 totalSoil = field.totalSoil();
    //     vm.prank(brean);
    //     field.sow(totalSoil, 1e6, LibTransfer.From.EXTERNAL);
    //     assertEq(uint256(field.totalSoil()), 0, "totalSoil greater than 0");
    //     assertEq(uint256(field.totalRealSoil()), 0, "s.soil greater than 0");
    //     assertEq(field.totalUnharvestable(), remainingPods, "Unharvestable pods does not Equal Expected.");
    // }

    // /**
    //  * sowing all soil, with variable soil, temperature, and block below peg
    //  * pods issued should always be lower than remainingPods
    //  * soil/bean used should always be equal to soil issued.
    //  */
    // function testSowAllMorningAuctionBelowPeg(
    //     uint256 soil,
    //     uint32 temperature,
    //     uint256 _block
    // ) prank(brean) public {
    //     sowAllInit(
    //         temperature,
    //         soil,
    //         _block,
    //         false
    //     );
    //     uint256 remainingPods = field.remainingPods();
    //     uint256 totalSoil = field.totalSoil();
    //     field.sow(totalSoil, 1e6, LibTransfer.From.EXTERNAL);
    //     assertEq(uint256(field.totalSoil()), 0, "totalSoil greater than 0");
    //     assertEq(field.totalUnharvestable(), remainingPods, "Unharvestable pods does not Equal Expected.");
    // }

    // //////////////////// BEFOREEACH HELPERS ////////////////////

    // function _beforeEachMorningAuction() public {
    //     season.setMaxTempE(100);
    //     season.setSoilE(100e6);
    //     season.setAbovePegE(true);
    // }

    // function _beforeEachMorningAuctionBelowPeg() public {
    //     season.setMaxTempE(100);
    //     season.setSoilE(100e6);
    //     season.setAbovePegE(false);
    // }

    // function _beforeEachFullHarvest() public {
    //     field.incrementTotalHarvestableE(101e6);
    //     uint256[] memory harvestPlot = new uint[](1);
    //     harvestPlot[0] = 0;
    //     vm.prank(brean);
    //     vm.expectEmit(true, true, false, true);
    //     // account, index, beans, pods
    //     emit Harvest(brean, harvestPlot, 101 * 1e6);
    //     field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
    // }

    // function _beforeEachPartialHarvest() public {
    //     field.incrementTotalHarvestableE(50e6);
    //     uint256[] memory harvestPlot = new uint[](1);
    //     harvestPlot[0] = 0;
    //     vm.prank(brean);
    //     vm.expectEmit(true, true, false, true);
    //     // account, index, beans, pods
    //     emit Harvest(brean, harvestPlot, 50e6);
    //     field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
    // }

    // function _beforeEachHarvest() public {
    //     season.setSoilE(200e6);
    //     vm.roll(30); // after morning Auction
    //     vm.prank(brean);
    //     field.sow(100e6, 1, LibTransfer.From.EXTERNAL);
    //     vm.prank(siloChad);
    //     field.sow(100e6, 1, LibTransfer.From.EXTERNAL);
    // }

    // function _beforeEachHarvestEntirePlotWithListing() public {
    //     field.incrementTotalHarvestableE(101e6);
    //     vm.prank(brean);
    //     marketplace.createPodListing(0, 0, 500, 500000, 200 * 1e6, 1 * 1e6, LibTransfer.To.EXTERNAL);
    //     uint256[] memory harvestPlot = new uint[](1);
    //     harvestPlot[0] = 0;
    //     vm.prank(brean);
    //     vm.expectEmit(true, true, false, true);
    //     // account, index, beans, pods
    //     emit Harvest(brean, harvestPlot, 101e6);
    //     field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
    // }

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

    // function _beforeEachSomeSowFromInternal() prank(brean) public {
    //     season.setSoilE(200e6);
    //     token.transferToken(C.bean(), brean, 100e6, LibTransfer.From.EXTERNAL, LibTransfer.To.INTERNAL);
    //     vm.expectEmit(true, true, true, true);
    //     // account, index, beans, pods
    //     emit Sow(brean, 0, 100e6, 101e6);
    //     field.sow(100e6, 1e6, LibTransfer.From.INTERNAL);
    // }

    // function _beforeEachSomeSowFromInternalTolerant() prank(brean) public {
    //     season.setSoilE(200e6);
    //     token.transferToken(C.bean(), brean, 100e6, LibTransfer.From.EXTERNAL, LibTransfer.To.INTERNAL);
    //     vm.expectEmit(true, true, true, true);
    //     // account, index, beans, pods
    //     emit Sow(brean, 0, 100e6, 101e6);
    //     field.sow(100e6, 1e6, LibTransfer.From.INTERNAL_TOLERANT);
    // }

    // function _beforeEachSowMin() prank(brean) public {
    //     season.setSoilE(100e6);
    //     vm.roll(30);
    //     vm.expectEmit(true, true, true, true);
    //     // account, index, beans, pods
    //     emit Sow(brean, 0, 100e6, 101e6);
    //     field.sowWithMin(200e6, 1e6, 100e6, LibTransfer.From.EXTERNAL);
    // }

    // function _beforeEachSowMinWithEnoughSoil() prank(brean) public {
    //     season.setSoilE(200e6);
    //     vm.expectEmit(true, true, true, true);
    //     // account, index, beans, pods
    //     emit Sow(brean, 0, 100e6, 101e6);
    //     field.sowWithMin(100e6, 1e6, 50e6, LibTransfer.From.EXTERNAL);
    // }

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

    // // Test Helpers
    // function max(uint256 a, uint256 b) internal pure returns (uint256) {
    //     return a >= b ? a : b;
    // }

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

    // function sowAllInit(
    //     uint32 temperature,
    //     uint256 soil,
    //     uint256 _block,
    //     bool abovePeg
    // ) public {
    //     temperature = uint32(bound(uint256(temperature), 1, 10000));
    //     soil = bound(soil, 1e6, 100e6);
    //     // maximum blockdelta within a season is 300 blocks, but the block starts at 1
    //     _block = bound(_block, 1, 301);
    //     season.setMaxTempE(temperature);
    //     season.setSoilE(soil);
    //     season.setAbovePegE(abovePeg);
    //     vm.roll(_block);
    // }
}
