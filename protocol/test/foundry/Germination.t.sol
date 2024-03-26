// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper} from "./utils/TestHelper.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockSeasonFacet, MockSiloFacet, C} from "test/foundry/utils/BeanstalkFacets.sol";

contract SiloTest is TestHelper {

    IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);
    MockSiloFacet silo = MockSiloFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    uint256 constant MAX_DEPOSIT_BOUND = 1.7e22; // 2 ** 128 / 2e16
  
    function setUp() public {
        initializeBeanstalkTestState(true, false);
        
        // mint 1000 beans to user 1 and user 2 (user 0 is the beanstalk deployer).
        address[] memory farmers = new address[](2);
        farmers[0] = users[1]; farmers[1] = users[2];
        mintTokensToUsers(farmers, C.BEAN,  MAX_DEPOSIT_BOUND);
    }


    //////////// DEPOSITS ////////////

    /**
     * @notice verify that silo deposits correctly
     * germinating and update the state of the silo.
     */
    function testSiloDepositsGerminating(uint256 amount) public {
        amount = bound(amount, 1, MAX_DEPOSIT_BOUND);

        // deposit 1000 beans to silo from user 1 and 2.
        vm.prank(users[1]);
        silo.deposit(C.BEAN, amount, LibTransfer.From.EXTERNAL);
        vm.prank(users[2]);
        silo.deposit(C.BEAN, amount, LibTransfer.From.EXTERNAL);

        // verify new state of silo.
        checkSiloAndUser(users[1], 0, amount);
    }

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season has elapsed.
     */
    function testSiloDepositsGerminatingCont(uint256 amount) public {
        amount = bound(amount, 1, MAX_DEPOSIT_BOUND);

        // deposit 1000 beans to silo from user 1 and 2.
        vm.prank(users[1]);
        silo.deposit(C.BEAN, amount, LibTransfer.From.EXTERNAL);
        vm.prank(users[2]);
        silo.deposit(C.BEAN, amount, LibTransfer.From.EXTERNAL);

        // call sunrise. 
        season.siloSunrise(0);

        // verify new state of silo.
        checkSiloAndUser(users[1], 0, amount);
    }

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season.
     */
    function testSiloDepositsEndGermination(uint256 amount) public {
        amount = bound(amount, 1, MAX_DEPOSIT_BOUND);
        
        // deposit 1000 beans to silo from user 1 and 2.
        vm.prank(users[1]);
        silo.deposit(C.BEAN, amount, LibTransfer.From.EXTERNAL);
        vm.prank(users[2]);
        silo.deposit(C.BEAN, amount, LibTransfer.From.EXTERNAL);

        // call sunrise twice.
        season.siloSunrise(0);
        season.siloSunrise(0);

        // verify new state of silo.
        checkSiloAndUser(users[1], amount, 0);
    }


    ////// SILO VIEW HELPERS //////

    function checkSiloAndUser(address farmer, uint256 total, uint256 germTotal) public view {
        checkTotalSiloBalances(2 * total);
        checkFarmerSiloBalances(farmer, total);
        checkTotalGerminatingBalances(2 * germTotal);
        checkFarmerGerminatingBalances(users[1], germTotal);
    }
    
    function checkTotalSiloBalances(uint256 expected) public view {
        assertEq(bs.totalStalk(), expected * 1e4, "TotalStalk"); // 1e6 (1 bdv) * 1e4 = 1e10 (1 stalk)
        assertEq(bs.totalRoots(), expected * 1e16, "TotalRoots");
        assertEq(bs.getTotalDeposited(C.BEAN), expected, "TotalDeposited");
        assertEq(bs.getTotalDepositedBdv(C.BEAN), expected, "TotalDepositedBdv");
    }

    function checkFarmerSiloBalances(address farmer, uint256 expected) public view { 
        assertEq(bs.balanceOfStalk(farmer), expected * 1e4, "FarmerStalk");
        assertEq(bs.balanceOfRoots(farmer), expected * 1e16, "FarmerRoots");
    }

    function checkTotalGerminatingBalances(uint256 expected) public view {
        assertEq(bs.getTotalGerminatingStalk(), expected * 1e4, "TotalGerminatingStalk");
        assertEq(bs.getGerminatingTotalDeposited(C.BEAN), expected, "getGerminatingTotalDeposited");
        assertEq(bs.getGerminatingTotalDepositedBdv(C.BEAN), expected, "getGerminatingTotalDepositedBdv");
    }

    function checkFarmerGerminatingBalances(address farmer, uint256 expected) public view {
        assertEq(bs.balanceOfGerminatingStalk(farmer), 1e4 * expected, "balanceOfGerminatingStalk");
    }
}