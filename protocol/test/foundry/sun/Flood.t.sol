// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IMockFBeanstalk, C} from "test/foundry/utils/TestHelper.sol";
import {IWell, IERC20} from "contracts/interfaces/basin/IWell.sol";
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
}
