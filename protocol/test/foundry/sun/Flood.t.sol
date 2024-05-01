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

    // MockTokens.
    MockToken bean = MockToken(C.BEAN);
    MockToken weth = MockToken(C.WETH);

    // test accounts
    address[] farmers;

    // well in test:
    address well;

    function setUp() public {
        initializeBeanstalkTestState(true, false);
        well = C.BEAN_ETH_WELL;
        // init user.
        farmers.push(users[1]);
        vm.prank(farmers[0]);
        C.bean().approve(BEANSTALK, type(uint256).max);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            well,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        // init wsteth well too

        // users 1 and 2 deposits 1000 beans into the silo.
        depostBeansForUser(users[1], 1000e6);
        depostBeansForUser(users[2], 1000e6);

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
        // verify sop well is not initalized in storage prior to sop.
        assertTrue(bs.getSopWell() == address(0));

        // setDeltaBforWell(1000e6, C.BEAN_ETH_WELL, C.WETH);

        setReserves(C.BEAN_ETH_WELL, 1000000e6, 1100e18);

        // update pumps
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        season.rainSunrise();
        bs.mow(users[1], C.BEAN);
        season.rainSunrise();

        Storage.Season memory s = seasonGetters.time();
        IWell well = IWell(bs.getSopWell());

        assertTrue(s.lastSop == s.rainStart);
        assertTrue(s.lastSopSeason == s.current);
        // check weth balance of beanstalk
        assertEq(IERC20(C.WETH).balanceOf(BEANSTALK), 51191151829696906017);
        // after the swap, the composition of the pools are
        uint256[] memory balances = well.getReserves();
        assertTrue(balances[0] == 1048808848170);
        assertTrue(balances[1] == 1048808848170303093983);

        // tracks user plenty before update
        uint256 userPlenty = bs.balanceOfPlenty(users[1]);
        assertEq(userPlenty, 25595575914848452999);

        // tracks user plenty after update
        bs.mow(users[1], C.BEAN);

        SiloGettersFacet.AccountSeasonOfPlenty memory userSop = siloGetters.balanceOfSop(users[1]);
        assertTrue(userSop.lastRain == 6);
        assertTrue(userSop.lastSop == 6);
        assertTrue(userSop.roots == 10004000000000000000000000);
        assertTrue(userSop.plenty == 25595575914848452999);
        assertTrue(userSop.plentyPerRoot == 2558534177813719812);

        // each user should get half of the eth gained
        assertTrue(bs.balanceOfPlenty(users[2]) == 25595575914848452999);

        // tracks user2 plenty after update
        bs.mow(users[2], C.BEAN);
        userSop = siloGetters.balanceOfSop(users[2]);
        assertTrue(userSop.lastRain == 6);
        assertTrue(userSop.lastSop == 6);
        assertTrue(userSop.roots == 10004000000000000000000000);
        assertTrue(userSop.plenty == 25595575914848452999);
        assertTrue(userSop.plentyPerRoot == 2558534177813719812);

        // claims user plenty
        bs.mow(users[2], C.BEAN);
        vm.prank(users[2]);
        bs.claimPlenty();
        assertTrue(bs.balanceOfPlenty(users[2]) == 0);
        assertEq(IERC20(C.WETH).balanceOf(users[2]), 25595575914848452999);

        // changes the sop well
        assertTrue(bs.getSopWell() != address(0));
        assertTrue(bs.getSopWell() == C.BEAN_ETH_WELL);
    }

    //////////// Helpers ////////////

    function depostBeansForUser(address user, uint256 beans) public {
        // Create 1 deposit,  1000 Beans to user
        C.bean().mint(user, beans);

        vm.prank(user);
        C.bean().approve(BEANSTALK, type(uint256).max);
        vm.prank(user);
        bs.deposit(C.BEAN, beans, 0);

        // pass germination process
        season.siloSunrise(0);
        season.siloSunrise(0);

        // mow, so that lastUpdated has been called at least once
        vm.prank(user);
        bs.mow(user, C.BEAN);
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
}
