// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IMockFBeanstalk, C} from "test/foundry/utils/TestHelper.sol";
import {IWell, IERC20, Call} from "contracts/interfaces/basin/IWell.sol";
import {MockPump} from "contracts/mocks/well/MockPump.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {MockFieldFacet} from "contracts/mocks/mockFacets/MockFieldFacet.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {Storage} from "contracts/libraries/LibAppStorage.sol";
import {SeasonGettersFacet} from "contracts/beanstalk/sun/SeasonFacet/SeasonGettersFacet.sol";
import {SiloGettersFacet} from "contracts/beanstalk/silo/SiloFacet/SiloGettersFacet.sol";
import {Weather} from "contracts/beanstalk/sun/SeasonFacet/Weather.sol";
import {console} from "forge-std/console.sol";

/**
 * @title FloodTest
 * @author pizzaman1337
 * @notice Tests the `flood` functionality.
 */
contract FloodTest is TestHelper {
    // Interfaces.
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
    SeasonGettersFacet seasonGetters = SeasonGettersFacet(BEANSTALK);
    MockFieldFacet field = MockFieldFacet(BEANSTALK);
    SiloGettersFacet siloGetters = SiloGettersFacet(BEANSTALK);
    Weather weather = Weather(BEANSTALK);

    // MockTokens.
    MockToken bean = MockToken(C.BEAN);
    MockToken weth = MockToken(C.WETH);

    // test accounts
    address[] farmers;

    function setUp() public {
        initializeBeanstalkTestState(true, false);
        address well = C.BEAN_ETH_WELL;
        // init user.
        farmers.push(users[1]);
        vm.prank(farmers[0]);
        C.bean().approve(BEANSTALK, type(uint256).max);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            well,
            1000000e6, // 10,000 Beans
            1000 ether // 10 ether.
        );

        addLiquidityToWell(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        season.siloSunrise(0);
        season.siloSunrise(0);

        // users 1 and 2 deposits 1000 beans into the silo.
        address[] memory depositUsers = new address[](2);
        depositUsers[0] = users[1];
        depositUsers[1] = users[2];
        depostBeansForUsers(depositUsers, 1_000e6, 10_000e6);
        // depostBeansForUser(users[2], 1000e6);

        // give user2 some eth
        vm.deal(users[2], 10 ether);

        // without this, 25 rainSunrises runs out of gas
        vm.pauseGasMetering();
    }

    function testNotRaining() public {
        Storage.Season memory s = seasonGetters.time();

        assertFalse(s.raining);
    }

    function testRaining() public {
        field.incrementTotalPodsE(1000e18);
        season.rainSunrise();
        bs.mow(users[1], C.BEAN);

        Storage.Rain memory rain = seasonGetters.rain();
        Storage.Season memory s = seasonGetters.time();

        assertTrue(s.rainStart == s.current);
        assertTrue(s.raining);
        assertEq(rain.pods, bs.totalPods());
        assertEq(rain.roots, 20008000000000000000000000);

        SiloGettersFacet.AccountSeasonOfPlenty memory sop = siloGetters.balanceOfSop(users[1]);

        assertTrue(sop.lastRain == s.rainStart);
        assertTrue(sop.roots == 10004000000000000000000000);
    }

    function testStopsRaining() public {
        field.incrementTotalPodsE(1000e18);
        season.rainSunrise();
        bs.mow(users[1], C.BEAN);

        season.droughtSunrise();
        bs.mow(users[1], C.BEAN);

        Storage.Season memory s = seasonGetters.time();
        assertTrue(s.rainStart == s.current - 1);

        SiloGettersFacet.AccountSeasonOfPlenty memory sop = siloGetters.balanceOfSop(users[1]);
        assertTrue(sop.lastRain == 0);
    }

    function testSopsWhenAtPeg() public {
        season.rainSunrises(25);
        Storage.Season memory s = seasonGetters.time();

        assertTrue(s.lastSop == 0);
        assertTrue(s.lastSopSeason == 0);
    }

    function testSopsBelowPeg() public {
        setDeltaBforWell(-1000e6, C.BEAN_ETH_WELL, C.WETH);
        // update pumps
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);
        season.rainSunrises(25);

        Storage.Season memory s = seasonGetters.time();
        assertTrue(s.lastSop == 0);
        assertTrue(s.lastSopSeason == 0);
    }

    function testOneSop() public {
        // setDeltaBforWell(1000e6, C.BEAN_ETH_WELL, C.WETH);

        setReserves(C.BEAN_ETH_WELL, 1000000e6, 1100e18);

        // update pumps
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        season.rainSunrise();
        bs.mow(users[1], C.BEAN);
        season.rainSunrise();

        Storage.Season memory s = seasonGetters.time();

        assertTrue(s.lastSop == s.rainStart);
        assertTrue(s.lastSopSeason == s.current);
        // check weth balance of beanstalk
        assertEq(IERC20(C.WETH).balanceOf(BEANSTALK), 51191151829696906017);
        // after the swap, the composition of the pools are
        uint256[] memory balances = IWell(C.BEAN_ETH_WELL).getReserves();
        assertTrue(balances[0] == 1048808848170);
        assertTrue(balances[1] == 1048808848170303093983);

        // tracks user plenty before update
        uint256 userPlenty = bs.balanceOfPlenty(users[1], C.BEAN_ETH_WELL);
        assertEq(userPlenty, 25595575914848452999);

        // tracks user plenty after update
        bs.mow(users[1], C.BEAN);

        SiloGettersFacet.AccountSeasonOfPlenty memory userSop = siloGetters.balanceOfSop(users[1]);
        assertTrue(userSop.lastRain == 6);
        assertTrue(userSop.lastSop == 6);
        assertTrue(userSop.roots == 10004000000000000000000000);

        assertTrue(userSop.farmerSops.length > 0);

        assertTrue(userSop.farmerSops[0].well == C.BEAN_ETH_WELL);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plenty == 25595575914848452999);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plentyPerRoot == 2558534177813719812);

        // each user should get half of the eth gained
        assertTrue(bs.balanceOfPlenty(users[2], C.BEAN_ETH_WELL) == 25595575914848452999);

        // tracks user2 plenty after update
        bs.mow(users[2], C.BEAN);
        userSop = siloGetters.balanceOfSop(users[2]);
        assertTrue(userSop.lastRain == 6);
        assertTrue(userSop.lastSop == 6);
        assertTrue(userSop.roots == 10004000000000000000000000);
        assertTrue(userSop.farmerSops[0].well == C.BEAN_ETH_WELL);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plenty == 25595575914848452999);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plentyPerRoot == 2558534177813719812);

        // claims user plenty
        bs.mow(users[2], C.BEAN);
        vm.prank(users[2]);
        bs.claimPlenty(C.BEAN_ETH_WELL);
        assertTrue(bs.balanceOfPlenty(users[2], C.BEAN_ETH_WELL) == 0);
        assertEq(IERC20(C.WETH).balanceOf(users[2]), 25595575914848452999);
    }

    function testMultipleSop() public {
        // mow both users
        bs.mow(users[1], C.BEAN);
        bs.mow(users[2], C.BEAN);

        setReserves(C.BEAN_ETH_WELL, 1000000e6, 1100e18);
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        season.rainSunrise();
        bs.mow(users[2], C.BEAN);
        season.rainSunrise();
        season.droughtSunrise();

        setReserves(C.BEAN_ETH_WELL, 1048808848170, 1100e18);
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        season.rainSunrises(2);

        // sops p > 1
        Storage.Season memory s = seasonGetters.time();
        uint256[] memory reserves = IWell(C.BEAN_ETH_WELL).getReserves();

        assertTrue(s.lastSop == s.rainStart);
        assertTrue(s.lastSopSeason == s.current);
        assertEq(IERC20(C.WETH).balanceOf(BEANSTALK), 77091653184968908600);

        assertTrue(reserves[0] == 1074099498643);
        assertTrue(reserves[1] == 1074099498644727997417);

        // tracks user plenty before update
        uint256 userPlenty = bs.balanceOfPlenty(users[1], C.BEAN_ETH_WELL);
        assertEq(userPlenty, 38544532214605630101);

        // tracks user plenty after update
        bs.mow(users[1], C.BEAN);
        SiloGettersFacet.AccountSeasonOfPlenty memory userSop = siloGetters.balanceOfSop(users[1]);

        assertTrue(userSop.lastRain == 9);

        assertTrue(userSop.lastSop == 9);
        assertTrue(userSop.roots == 10004000000000000000000000);
        assertTrue(userSop.farmerSops[0].well == C.BEAN_ETH_WELL);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plenty == 38544532214605630101);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plentyPerRoot == 3852912056637907847);

        // tracks user2 plenty
        uint256 user2Plenty = bs.balanceOfPlenty(users[2], C.BEAN_ETH_WELL);
        assertEq(user2Plenty, 38547120970363278477);

        // tracks user2 plenty after update
        bs.mow(users[2], C.BEAN_ETH_WELL);
        bs.mow(users[2], C.BEAN);
        userSop = siloGetters.balanceOfSop(users[2]);
        assertTrue(userSop.lastRain == 9);
        assertTrue(userSop.lastSop == 9);
        assertTrue(userSop.roots == 10006000000000000000000000);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plenty == 38547120970363278477);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plentyPerRoot == 3852912056637907847);
    }

    function testWithCurrentBalances() public {
        setReserves(C.BEAN_ETH_WELL, 1_000_000e6, 1_100e18);
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        // set instantaneous reserves differently
        setInstantaneousReserves(C.BEAN_ETH_WELL, 900_000e6, 1_100e18);

        season.rainSunrise();
        bs.mow(users[2], C.BEAN_ETH_WELL);
        season.rainSunrise();
        // end before each from hardhat test

        // sops p > 1
        Storage.Season memory s = seasonGetters.time();
        uint256[] memory reserves = IWell(C.BEAN_ETH_WELL).getReserves();

        assertTrue(s.lastSop == s.rainStart);
        assertTrue(s.lastSopSeason == s.current);
        assertEq(IERC20(C.WETH).balanceOf(BEANSTALK), 51191151829696906017);

        assertTrue(reserves[0] == 1048808848170);
        assertTrue(reserves[1] == 1048808848170303093983);

        // tracks user plenty before update
        uint256 userPlenty = bs.balanceOfPlenty(users[1], C.BEAN_ETH_WELL);
        assertEq(userPlenty, 25595575914848452999);

        // tracks user plenty after update
        bs.mow(users[1], C.BEAN);
        SiloGettersFacet.AccountSeasonOfPlenty memory userSop = siloGetters.balanceOfSop(users[1]);

        assertTrue(userSop.lastRain == 6);
        assertTrue(userSop.lastSop == 6);
        assertTrue(userSop.roots == 10004000000000000000000000);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plenty == 25595575914848452999);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plentyPerRoot == 2558534177813719812);

        // tracks user2 plenty
        uint256 user2Plenty = bs.balanceOfPlenty(users[2], C.BEAN_ETH_WELL);
        assertEq(user2Plenty, 25595575914848452999);

        // tracks user2 plenty after update
        bs.mow(users[2], C.BEAN_ETH_WELL);
        bs.mow(users[2], C.BEAN);
        userSop = siloGetters.balanceOfSop(users[2]);
        assertTrue(userSop.lastRain == 6);
        assertTrue(userSop.lastSop == 6);
        assertTrue(userSop.roots == 10004000000000000000000000);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plenty == 25595575914848452999);
        assertTrue(userSop.farmerSops[0].wellsPlenty.plentyPerRoot == 2558534177813719812);

        // claims user plenty
        bs.mow(users[2], C.BEAN_ETH_WELL);
        vm.prank(users[2]);
        bs.claimPlenty(C.BEAN_ETH_WELL);
        assertTrue(bs.balanceOfPlenty(users[2], C.BEAN_ETH_WELL) == 0);
        assertEq(IERC20(C.WETH).balanceOf(users[2]), 25595575914848452999);
    }

    function testCalculateSopPerWell() public {
        Weather.WellDeltaB[] memory wellDeltaBs = new Weather.WellDeltaB[](3);
        wellDeltaBs[0].deltaB = 100;
        wellDeltaBs[1].deltaB = 100;
        wellDeltaBs[2].deltaB = -100;
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);
        assertEq(wellDeltaBs[0].reductionAmount, 50);
        assertEq(wellDeltaBs[1].reductionAmount, 50);
        assertEq(wellDeltaBs[2].reductionAmount, 0);

        wellDeltaBs = new Weather.WellDeltaB[](4);
        wellDeltaBs[0].deltaB = 90;
        wellDeltaBs[1].deltaB = 80;
        wellDeltaBs[2].deltaB = 20;
        wellDeltaBs[3].deltaB = -120;
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);
        assertEq(wellDeltaBs[0].reductionAmount, 40);
        assertEq(wellDeltaBs[1].reductionAmount, 30);
        assertEq(wellDeltaBs[2].reductionAmount, 0);
        assertEq(wellDeltaBs[3].reductionAmount, 0);

        wellDeltaBs = new Weather.WellDeltaB[](7);
        wellDeltaBs[0].deltaB = 90;
        wellDeltaBs[1].deltaB = 80;
        wellDeltaBs[2].deltaB = 70;
        wellDeltaBs[3].deltaB = 60;
        wellDeltaBs[4].deltaB = 50;
        wellDeltaBs[5].deltaB = 40;
        wellDeltaBs[6].deltaB = -120;
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);
        assertEq(wellDeltaBs[0].reductionAmount, 70);
        assertEq(wellDeltaBs[1].reductionAmount, 60);
        assertEq(wellDeltaBs[2].reductionAmount, 50);
        assertEq(wellDeltaBs[3].reductionAmount, 40);
        assertEq(wellDeltaBs[4].reductionAmount, 30);
        assertEq(wellDeltaBs[5].reductionAmount, 20);
        assertEq(wellDeltaBs[6].reductionAmount, 0);

        wellDeltaBs = new Weather.WellDeltaB[](4);
        wellDeltaBs[0].deltaB = 90;
        wellDeltaBs[1].deltaB = 80;
        wellDeltaBs[2].deltaB = -70;
        wellDeltaBs[3].deltaB = -200;
        vm.expectRevert("Flood: Overall deltaB is negative");
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);

        wellDeltaBs = new Weather.WellDeltaB[](1);
        wellDeltaBs[0].deltaB = 90;
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);
        assertEq(wellDeltaBs[0].reductionAmount, 90);

        // test just 2 wells, all positive
        wellDeltaBs = new Weather.WellDeltaB[](2);
        wellDeltaBs[0].deltaB = 90;
        wellDeltaBs[1].deltaB = 80;
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);
        assertEq(wellDeltaBs[0].reductionAmount, 90);
        assertEq(wellDeltaBs[1].reductionAmount, 80);

        // test just 2 wells, one negative
        wellDeltaBs = new Weather.WellDeltaB[](2);
        wellDeltaBs[0].deltaB = 90;
        wellDeltaBs[1].deltaB = -80;
        wellDeltaBs = weather.calculateSopPerWell(wellDeltaBs);
        assertEq(wellDeltaBs[0].reductionAmount, 10);
        assertEq(wellDeltaBs[1].reductionAmount, 0);
    }

    // test making Beans harvestable
    function testHarvestablePodlineLessThanPointOnePercent() public {
        setReserves(C.BEAN_ETH_WELL, 1000000e6, 1100e18);

        // "buy" some pods
        bs.incrementTotalPodsE(1_000e6);

        uint256 initialBeanSupply = C.bean().totalSupply();
        uint256 initialPodLine = bs.podIndex();
        uint256 initialHarvestable = bs.totalHarvestable();

        // update pumps
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);
        season.rainSunrise();
        bs.mow(users[1], C.BEAN);
        season.rainSunrise();

        uint256 newHarvestable = bs.totalHarvestable();
        uint256 newBeanSupply = C.bean().totalSupply();
        uint256 newPodLine = bs.podIndex();

        assertTrue(newBeanSupply > initialBeanSupply); // Beans were minted
        assertTrue(newHarvestable == initialPodLine); // Pods cleared to end of podline because podline was <0.1% of supply
        assertTrue(initialPodLine > 0); // Start of test had a podline
        assertTrue(newHarvestable <= newPodLine); // All pods became harvestable, but nore more than the podline
        assertTrue(initialHarvestable == 0); // Before flood, no pods were harvestable
    }

    function testHarvestablePodlineMoreThanPointOnePercent() public {
        setReserves(C.BEAN_ETH_WELL, 1_000_000e6, 1_100e18);

        bs.incrementTotalPodsE(10_000e6);
        uint256 initialBeanSupply = C.bean().totalSupply();
        uint256 initialPodLine = bs.podIndex();
        uint256 initialHarvestable = bs.totalHarvestable();

        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);
        season.rainSunrise();
        bs.mow(users[1], C.BEAN);
        season.rainSunrise();

        uint256 newHarvestable = bs.totalHarvestable();
        uint256 newBeanSupply = C.bean().totalSupply();
        uint256 newPodLine = bs.podIndex();

        assertTrue(newBeanSupply > initialBeanSupply); // Beans were minted
        assertTrue(newHarvestable < newPodLine); // Pods didn't clear to end of podline because podline was >0.1% of supply
        assertTrue(initialPodLine > 0); // Start of test had a podline
        assertTrue(initialHarvestable == 0); // Before flood, no pods were harvestable
        assertApproxEqAbs(initialBeanSupply / 1000, newHarvestable, 1);
    }

    // TODO test with more wells?
    function testGetWellsByDeltaB() public {
        //set up wells to test
        addLiquidityToWell(C.BEAN_ETH_WELL, 13000e6, 10 ether);
        addLiquidityToWell(C.BEAN_WSTETH_WELL, 12000e6, 10 ether);

        Weather.WellDeltaB[] memory wells = weather.getWellsByDeltaB();

        //verify wells are in descending deltaB
        for (uint256 i = 0; i < wells.length - 1; i++) {
            assertGt(wells[i].deltaB, wells[i + 1].deltaB);
        }
    }

    function testQuickSort() public {
        Weather.WellDeltaB[] memory wells = new Weather.WellDeltaB[](5);
        wells[0] = Weather.WellDeltaB(C.BEAN_ETH_WELL, 100, 0);
        wells[1] = Weather.WellDeltaB(C.BEAN_WSTETH_WELL, 200, 0);
        wells[2] = Weather.WellDeltaB(C.BEAN_ETH_WELL, -300, 0);
        wells[3] = Weather.WellDeltaB(C.BEAN_ETH_WELL, 400, 0);
        wells[4] = Weather.WellDeltaB(C.BEAN_ETH_WELL, -500, 0);
        wells = weather.quickSort(wells, 0, int(wells.length - 1));
        assertEq(wells[0].deltaB, 400);
        assertEq(wells[1].deltaB, 200);
        assertEq(wells[2].deltaB, 100);
        assertEq(wells[3].deltaB, -300);
        assertEq(wells[4].deltaB, -500);

        wells = new Weather.WellDeltaB[](2);
        wells[0] = Weather.WellDeltaB(C.BEAN_ETH_WELL, 200, 0);
        wells[1] = Weather.WellDeltaB(C.BEAN_WSTETH_WELL, 100, 0);
        wells = weather.quickSort(wells, 0, int(wells.length - 1));
        assertEq(wells[0].deltaB, 200);
        assertEq(wells[1].deltaB, 100);

        wells = new Weather.WellDeltaB[](2);
        wells[0] = Weather.WellDeltaB(C.BEAN_ETH_WELL, 100, 0);
        wells[1] = Weather.WellDeltaB(C.BEAN_WSTETH_WELL, 200, 0);
        wells = weather.quickSort(wells, 0, int(wells.length - 1));
        assertEq(wells[0].deltaB, 200);
        assertEq(wells[1].deltaB, 100);
    }

    //////////// Helpers ////////////

    function depostBeansForUsers(
        address[] memory users,
        uint256 beansDeposit,
        uint256 beansMint
    ) public {
        for (uint i = 0; i < users.length; i++) {
            C.bean().mint(users[i], beansMint);
            vm.prank(users[i]);
            C.bean().approve(BEANSTALK, type(uint256).max);
            vm.prank(users[i]);
            bs.deposit(C.BEAN, beansDeposit, 0);
        }

        // pass germination process
        season.siloSunrise(0);
        season.siloSunrise(0);

        for (uint i = 0; i < users.length; i++) {
            // mow, so that lastUpdated has been called at least once
            vm.prank(users[i]);
            bs.mow(users[i], C.BEAN);
        }
    }

    function updateMockPumpUsingWellReserves(address well) public {
        Call[] memory pumps = IWell(well).pumps();
        for (uint i = 0; i < pumps.length; i++) {
            address pump = pumps[i].target;
            // pass to the pump the reserves that we actually have in the well
            uint[] memory reserves = IWell(well).getReserves();
            MockPump(pump).update(well, reserves, new bytes(0));
        }
    }

    function setInstantaneousReserves(address well, uint256 reserve0, uint256 reserve1) public {
        Call[] memory pumps = IWell(well).pumps();
        for (uint256 i = 0; i < pumps.length; i++) {
            address pump = pumps[i].target;
            // pass to the pump the reserves that we actually have in the well
            uint256[] memory reserves = new uint256[](2);
            reserves[0] = reserve0;
            reserves[1] = reserve1;

            MockPump(pump).setInstantaneousReserves(well, reserves);
        }
    }
}