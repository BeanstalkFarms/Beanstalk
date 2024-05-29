// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockSiloFacet} from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import {C} from "contracts/C.sol";

/**
 * @title GerminationTest
 * @author Brean
 * @notice Test the germination of beans in the silo.
 * @dev Tests total/farmer values and validates the germination process.
 */
contract GerminationTest is TestHelper {
    // Interfaces.
    MockSiloFacet silo = MockSiloFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    // test accounts
    address[] farmers;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // mint 1000 beans to user 1 and user 2 (user 0 is the beanstalk deployer).
        farmers.push(users[1]);
        farmers.push(users[2]);
        mintTokensToUsers(farmers, C.BEAN, MAX_DEPOSIT_BOUND);
    }

    //////////// DEPOSITS ////////////

    /**
     * @notice verify that silo deposits correctly
     * germinating and update the state of the silo.
     */
    function test_depositGerminates(uint256 amount) public {
        // deposits bean into the silo.
        (amount, ) = setUpSiloDepositTest(amount, farmers);

        // verify new state of silo.
        checkSiloAndUser(users[1], 0, amount);
    }

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season has elapsed.
     */
    function test_depositsContGerminating(uint256 amount) public {
        // deposits bean into the silo.
        (amount, ) = setUpSiloDepositTest(amount, farmers);

        // call sunrise.
        season.siloSunrise(0);

        // verify new state of silo.
        checkSiloAndUser(users[1], 0, amount);
    }

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season.
     */
    function test_depositsEndGermination(uint256 amount) public {
        // deposits bean into the silo.
        (amount, ) = setUpSiloDepositTest(amount, farmers);

        // call sunrise twice.
        season.siloSunrise(0);
        season.siloSunrise(0);

        // verify new state of silo.
        checkSiloAndUser(users[1], amount, 0);
    }

    ////// WITHDRAWS //////

    /**
     * @notice verify that silo deposits can be withdrawn while germinating.
     */
    function test_withdrawGerminating(uint256 amount) public {
        // deposits bean into the silo.
        int96 stem;
        (amount, stem) = setUpSiloDepositTest(amount, farmers);

        // withdraw beans from silo from user 1 and 2.
        withdrawDepositForUsers(farmers, C.BEAN, stem, amount, LibTransfer.To.EXTERNAL);

        // verify silo/farmer states.
        // verify new state of silo.
        checkSiloAndUser(users[1], 0, 0);
    }

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season has elapsed.
     */
    function test_withdrawGerminatingCont(uint256 amount) public {
        // deposits bean into the silo.
        int96 stem;
        (amount, stem) = setUpSiloDepositTest(amount, farmers);

        // call sunrise.
        season.siloSunrise(0);

        // withdraw beans from silo from user 1 and 2.
        withdrawDepositForUsers(farmers, C.BEAN, stem, amount, LibTransfer.To.EXTERNAL);

        // verify silo/farmer states.
        // verify new state of silo.
        checkSiloAndUser(users[1], 0, 0);
    }

    ////// TRANSFERS //////

    /**
     * @notice verify that silo deposits can be withdrawn while germinating.
     */
    function test_transferGerminating(uint256 amount) public {
        // deposits bean into the silo.
        int96 stem;
        (amount, stem) = setUpSiloDepositTest(amount, farmers);
        uint256 grownStalk = bs.balanceOfGrownStalk(users[1], C.BEAN);

        farmers.push(users[3]);
        farmers.push(users[4]);

        transferDepositFromUsersToUsers(farmers, stem, C.BEAN, amount);

        // verify silo/farmer states.
        // verify new state of silo.
        checkSiloAndUserWithGrownStalk(users[3], 0, amount, grownStalk);
    }

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season has elapsed.
     */
    function test_transferGerminatingCont(uint256 amount) public {
        // deposits bean into the silo.
        int96 stem;
        (amount, stem) = setUpSiloDepositTest(amount, farmers);
        season.siloSunrise(0);
        farmers.push(users[3]);
        farmers.push(users[4]);

        uint256 grownStalk = bs.balanceOfGrownStalk(users[1], C.BEAN);

        transferDepositFromUsersToUsers(farmers, stem, C.BEAN, amount);

        // verify silo/farmer states.
        // verify new state of silo.
        checkSiloAndUserWithGrownStalk(users[3], 0, amount, grownStalk);
    }

    // The following two tests verify that germinating deposits do not gain signorage from earned beans.
    // however, there is an edge case where the first deposit of the beanstalk system will gain signorage.
    // due to how roots are initally issued. Thus, earned beans tests assume prior deposits.
    function test_NoEarnedBeans(uint256 amount, uint256 sunriseBeans) public {
        sunriseBeans = bound(sunriseBeans, 0, MAX_DEPOSIT_BOUND);

        // see {initZeroEarnedBeansTest} for details.
        uint256 _amount = initZeroEarnedBeansTest(amount, farmers, users[3]);

        // calls sunrise with some beans issued.
        season.siloSunrise(sunriseBeans);

        // verify silo/farmer states. Check user has no earned beans.
        assertEq(bs.totalStalk(), (2 * _amount + sunriseBeans) * C.STALK_PER_BEAN, "TotalStalk");
        assertEq(bs.balanceOfEarnedBeans(users[3]), 0, "balanceOfEarnedBeans");
        assertEq(bs.getTotalDeposited(C.BEAN), (2 * _amount + sunriseBeans), "TotalDeposited");
        assertEq(
            bs.getTotalDepositedBdv(C.BEAN),
            (2 * _amount + sunriseBeans),
            "TotalDepositedBdv"
        );
        assertEq(bs.totalRoots(), 2 * _amount * C.STALK_PER_BEAN * C.getRootsBase(), "TotalRoots");
    }

    // function testNoEarnedBeansPartialGerm(uint256 amount, uint256 sunriseBeans) public {
    //     uint256 _sunriseBeans = bound(sunriseBeans, 0, MAX_DEPOSIT_BOUND);

    //     // see {initZeroEarnedBeansTest} for details.
    //     uint256 _amount = initZeroEarnedBeansTest(amount, farmers, users[3]);

    //     // calls sunrise with some beans issued.
    //     season.siloSunrise(sunriseBeans);

    //     // verify silo/farmer states. Check user has no earned beans.
    //     // assertEq(bs.totalStalk(), (2 * _amount + sunriseBeans) * C.STALK_PER_BEAN,  "TotalStalk0");
    //     assertEq(bs.balanceOfEarnedBeans(users[3]), 0, "balanceOfEarnedBeans");
    //     assertEq(bs.getTotalDeposited(C.BEAN), (2 * _amount + sunriseBeans), "TotalDeposited");
    //     assertEq(bs.getTotalDepositedBdv(C.BEAN), (2 * _amount + sunriseBeans), "TotalDepositedBdv");
    //     // assertEq(bs.totalRoots(), 2 * _amount * C.STALK_PER_BEAN * C.getRootsBase(), "TotalRoots");

    //     // calls sunrise (and finishes germination for user 3):
    //     season.siloSunrise(_sunriseBeans);

    //     // verify silo/farmer states. Check user has no earned beans.
    //     // assertEq(bs.totalStalk(), (3 * _amount + 2 * sunriseBeans) * C.STALK_PER_BEAN,  "TotalStalk1");
    //     assertEq(bs.balanceOfEarnedBeans(users[3]), 0, "balanceOfEarnedBeans");
    //     // assertEq(bs.getTotalDeposited(C.BEAN), (3 * _amount + 2 * sunriseBeans), "TotalDeposited");
    //     // assertEq(bs.getTotalDepositedBdv(C.BEAN), (3 * _amount + 2 * sunriseBeans), "TotalDepositedBdv");
    //     // assertEq(bs.totalRoots(), 5 * _amount * C.STALK_PER_BEAN * C.getRootsBase() / 2, "TotalRoots");

    //     season.siloSunrise(0);

    //     // verify silo/farmer states. Check user has no earned beans.
    //     // assertEq(bs.totalStalk(), (3 * _amount + 2 * sunriseBeans) * C.STALK_PER_BEAN,  "TotalStalk2");
    //     assertEq(bs.balanceOfEarnedBeans(users[3]), 0, "balanceOfEarnedBeans");
    //     // assertEq(bs.getTotalDeposited(C.BEAN), (3 * _amount + 2 * sunriseBeans), "TotalDeposited");
    //     // assertEq(bs.getTotalDepositedBdv(C.BEAN), (3 * _amount + 2 * sunriseBeans), "TotalDepositedBdv");
    //     // assertEq(bs.totalRoots(), 5 * _amount * C.STALK_PER_BEAN * C.getRootsBase()/ 2, "TotalRoots");
    // }

    ////// SILO TEST HELPERS //////

    /**
     * @notice Withdraw beans from the silo for multiple users.
     * @param users The users to withdraw beans from.
     * @param token The token to withdraw.
     * @param stem The stem tip for the deposited beans.
     * @param amount The amount of beans to withdraw.
     * @param mode The withdraw mode.
     */
    function withdrawDepositForUsers(
        address[] memory users,
        address token,
        int96 stem,
        uint256 amount,
        LibTransfer.To mode
    ) public {
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            silo.withdrawDeposit(token, stem, amount, mode);
        }
    }

    /**
     * @notice Transfer beans from the silo for multiple users.
     * @param users Users.
     * @param stem The stem tip for the deposited beans.
     * @param token The token to transfer.
     * @param amount The amount of beans to transfer
     * @dev This function transfers a deposit from user 'i' to
     * user 'i + 2'. Fails with invalid array input.
     */
    function transferDepositFromUsersToUsers(
        address[] memory users,
        int96 stem,
        address token,
        uint256 amount
    ) public {
        for (uint256 i = 0; i < users.length - 2; i++) {
            vm.prank(users[i]);
            silo.transferDeposit(users[i], users[i + 2], token, stem, amount);
        }
    }

    function initZeroEarnedBeansTest(
        uint256 amount,
        address[] memory initalFarmers,
        address newFarmer
    ) public returns (uint256 _amount) {
        // deposit 'amount' beans to the silo.
        (_amount, ) = setUpSiloDepositTest(amount, initalFarmers);

        // call sunrise twice to finish the germination process.
        season.siloSunrise(0);
        season.siloSunrise(0);

        address[] memory farmer = new address[](1);
        farmer[0] = newFarmer;
        // mint token to new farmer.
        mintTokensToUsers(farmer, C.BEAN, MAX_DEPOSIT_BOUND);

        // deposit into the silo.
        setUpSiloDepositTest(amount, farmer);
    }

    ////// ASSERTIONS //////

    /**
     * @notice Verifies the following parameters:
     * Total silo balances.
     * - total Stalk
     * - total Roots
     * - total deposited beans
     * - total deposited bdv
     * - total germinating stalk
     * - total germinating beans
     * - total germinating bdv
     */
    function checkSiloAndUser(address farmer, uint256 total, uint256 germTotal) public view {
        checkTotalSiloBalances(2 * total);
        checkFarmerSiloBalances(farmer, total);
        checkTotalGerminatingBalances(2 * germTotal);
        checkFarmerGerminatingBalances(users[1], germTotal);
    }

    /**
     * @notice checks silo balances, with grown stalk added.
     * @dev when a user interacts with the silo, mow() is called,
     * which credits the user with grown stalk. Tests which check
     * multi-season interactions should include the grown stalk.
     */
    function checkSiloAndUserWithGrownStalk(
        address farmer,
        uint256 total,
        uint256 germTotal,
        uint256 grownStalk
    ) public view {
        checkTotalSiloBalancesWithGrownStalk(2 * total, 2 * grownStalk);
        checkFarmerSiloBalancesWithGrownStalk(farmer, total, grownStalk);
        checkTotalGerminatingBalances(2 * germTotal);
        checkFarmerGerminatingBalances(farmer, germTotal);
    }

    function checkTotalSiloBalances(uint256 expected) public view {
        checkTotalSiloBalancesWithGrownStalk(expected, 0);
    }

    function checkTotalSiloBalancesWithGrownStalk(
        uint256 expected,
        uint256 grownStalk
    ) public view {
        assertEq(bs.totalStalk(), expected * C.STALK_PER_BEAN + grownStalk, "TotalStalk");
        assertEq(
            bs.totalRoots(),
            ((expected * C.STALK_PER_BEAN) + grownStalk) * C.getRootsBase(),
            "TotalRoots"
        );
        assertEq(bs.getTotalDeposited(C.BEAN), expected, "TotalDeposited");
        assertEq(bs.getTotalDepositedBdv(C.BEAN), expected, "TotalDepositedBdv");
    }

    function checkFarmerSiloBalances(address farmer, uint256 expected) public view {
        checkFarmerSiloBalancesWithGrownStalk(farmer, expected, 0);
    }

    function checkFarmerSiloBalancesWithGrownStalk(
        address farmer,
        uint256 expected,
        uint256 grownStalk
    ) public view {
        assertEq(
            bs.balanceOfStalk(farmer),
            (expected * C.STALK_PER_BEAN) + grownStalk,
            "FarmerStalk"
        );
        assertEq(
            bs.balanceOfRoots(farmer),
            ((expected * C.STALK_PER_BEAN) + grownStalk) * C.getRootsBase(),
            "FarmerRoots"
        );
    }

    function checkTotalGerminatingBalances(uint256 expected) public view {
        assertEq(
            bs.getTotalGerminatingStalk(),
            expected * C.STALK_PER_BEAN,
            "TotalGerminatingStalk"
        );
        assertEq(bs.getGerminatingTotalDeposited(C.BEAN), expected, "getGerminatingTotalDeposited");
        assertEq(
            bs.getGerminatingTotalDepositedBdv(C.BEAN),
            expected,
            "getGerminatingTotalDepositedBdv"
        );
    }

    function checkFarmerGerminatingBalances(address farmer, uint256 expected) public view {
        assertEq(
            bs.balanceOfGerminatingStalk(farmer),
            C.STALK_PER_BEAN * expected,
            "balanceOfGerminatingStalk"
        );
    }
}
