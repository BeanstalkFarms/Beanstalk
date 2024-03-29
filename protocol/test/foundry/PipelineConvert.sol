// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper} from "./utils/TestHelper.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockSiloFacet} from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import {ConvertFacet} from "contracts/beanstalk/silo/ConvertFacet.sol";
import {Bean} from "contracts/tokens/Bean.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {FarmFacet} from "contracts/beanstalk/farm/FarmFacet.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {Pipeline} from "contracts/pipeline/Pipeline.sol";
import {C} from "contracts/C.sol";
import {console} from "forge-std/console.sol";

/**
 * @title PipelineConvertTest
 * @author pizzaman1337
 * @notice Test pipeline convert.
 */
contract PipelineConvertTest is TestHelper {

    // Interfaces.
    IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);
    MockSiloFacet silo = MockSiloFacet(BEANSTALK);
    ConvertFacet convert = ConvertFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
    FarmFacet farm = FarmFacet(BEANSTALK);
    MockToken bean = MockToken(C.BEAN);
    MockToken beanEthWell = MockToken(C.BEAN_ETH_WELL);
    Pipeline pipeline = Pipeline(PIPELINE);

    
    // test accounts
    address[] farmers;

    // The largest deposit that can occur on the first season. 
    // Given the supply of beans should starts at 0,
    // this should never occur.
    uint256 constant MAX_DEPOSIT_BOUND = 1.7e22; // 2 ** 128 / 2e16
    uint256 constant MAX_UINT256 = type(uint256).max;

    bytes constant noData = abi.encode(0);
  
    function setUp() public {
        initializeBeanstalkTestState(true, false);
        
        // mint 1000 beans to user 1 and user 2 (user 0 is the beanstalk deployer).
        farmers.push(users[1]); 
        farmers.push(users[2]);
        mintTokensToUsers(farmers, C.BEAN,  MAX_DEPOSIT_BOUND);
    }

    //////////// DEPOSITS ////////////

    /**
     * @notice verify that silo deposits continue to germinate
     * After a season.
     */
    /*function testBasicConvertBeanToLP(uint256 amount) public {
        int96 stem;
        // deposits bean into the silo.
        (amount, stem) = setUpSiloDepositTest(amount, farmers);

        // call sunrise twice.
        season.siloSunrise(0);
        season.siloSunrise(0);

        uint256 amountOfBean = 200*1e6;

        // do the convert
        // first setup the pipeline calls

        // setup approve call
        bytes memory approveEncoded = abi.encodeWithSelector(
            bean.approve.selector,
            C.BEAN_ETH_WELL,
            MAX_UINT256
        );

        bytes memory addLiquidityEncoded = abi.encodeWithSelector(
            IWell.addLiquidity.selector,
            [abi.encode([amountOfBean, 0]), abi.encode(0), abi.encode(C.PIPELINE), abi.encode(type(uint256).max)]
        );

        bytes[] memory pipe0 = new bytes[](3);
        pipe0[0] = abi.encodePacked(bean);
        pipe0[1] = approveEncoded;
        pipe0[2] = noData;

        bytes[] memory pipe1 = new bytes[](3);
        pipe1[0] = abi.encodePacked(beanEthWell);
        pipe1[1] = addLiquidityEncoded;
        pipe1[2] = noData;

        
        bytes memory flattenedPipes = abi.encodePacked(pipe0, pipe1);

        bytes memory advancedFarm = abi.encodeWithSelector(pipeline.advancedPipe.selector, flattenedPipes, 0);

        bytes memory output = new bytes[](1);
        output[0] = abi.encode(advancedFarm, noData);

        convert.pipelineConvert(C.BEAN, [stem], [amount], C.BEAN_ETH_WELL, output);
    }*/

    function testBasicConvertBeanToLP(uint256 amount) public {
        int96 stem;
        // deposits bean into the silo.
        (amount, stem) = setUpSiloDepositTest(amount, farmers);
        console.log('stem: ');
        console.logInt(stem);
        console.log('amount: ', amount);

        // call sunrise twice.
        season.siloSunrise(0);
        season.siloSunrise(0);

        uint256 amountOfBean = 200 * 1e6;

        // do the convert
        // first setup the pipeline calls

        // setup approve call
        bytes memory approveEncoded = abi.encodeWithSelector(
            bean.approve.selector,
            C.BEAN_ETH_WELL,
            MAX_UINT256
        );

        bytes memory addLiquidityEncoded = abi.encodeWithSelector(
            IWell.addLiquidity.selector,
            [abi.encode([amountOfBean, 0]), abi.encode(0), abi.encode(C.PIPELINE), abi.encode(type(uint256).max)]
        );

        bytes[] memory pipe0 = new bytes[](3);
        pipe0[0] = abi.encodePacked(bean);
        pipe0[1] = approveEncoded;
        pipe0[2] = noData;

        bytes[] memory pipe1 = new bytes[](3);
        pipe1[0] = abi.encodePacked(beanEthWell);
        pipe1[1] = addLiquidityEncoded;
        pipe1[2] = noData;

        // is there a better/nicer way to do this?
        bytes memory flattenedPipes = abi.encodePacked(
            pipe0[0],
            pipe0[1],
            pipe0[2],
            pipe1[0],
            pipe1[1],
            pipe1[2]
        );

        bytes memory advancedFarm = abi.encodeWithSelector(pipeline.advancedPipe.selector, flattenedPipes, 0);

        bytes memory output = abi.encode(advancedFarm, noData);

        // Create arrays for stem and amount. Tried just passing in [stem] and it's like nope.
        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        vm.prank(users[1]); // do this as user 1
        convert.pipelineConvert(C.BEAN, stems, amounts, C.BEAN_ETH_WELL, output);
    }



    ////// SILO TEST HELPERS //////

    /**
     * @notice Set up the silo deposit test by depositing beans to the silo from multiple users.
     * @param amount The amount of beans to deposit.
     * @return _amount The actual amount of beans deposited.
     * @return stem The stem tip for the deposited beans.
     */
    function setUpSiloDepositTest(uint256 amount, address[] memory _farmers) public returns (uint256 _amount, int96 stem) {
        _amount = bound(amount, 1, MAX_DEPOSIT_BOUND);

        // deposit beans to silo from user 1 and 2.
        depositForUsers(_farmers, C.BEAN, _amount, LibTransfer.From.EXTERNAL);
        stem = bs.stemTipForToken(C.BEAN);
    }

    /**
     * @notice Deposit beans to the silo from multiple users.
     * @param users The users to deposit beans from.
     * @param token The token to deposit.
     * @param amount The amount of beans to deposit.
     * @param mode The deposit mode.
     */    
    function depositForUsers(
        address[] memory users,
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) public {
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            silo.deposit(token, amount, mode);
        }
    }

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
        mintTokensToUsers(farmer, C.BEAN,  MAX_DEPOSIT_BOUND);

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
    function checkSiloAndUserWithGrownStalk(address farmer, uint256 total, uint256 germTotal, uint256 grownStalk) public view {
        checkTotalSiloBalancesWithGrownStalk(2 * total, 2 * grownStalk);
        checkFarmerSiloBalancesWithGrownStalk(farmer, total, grownStalk);
        checkTotalGerminatingBalances(2 * germTotal);
        checkFarmerGerminatingBalances(farmer, germTotal);
    }

    function checkTotalSiloBalances(uint256 expected) public view {
       checkTotalSiloBalancesWithGrownStalk(expected, 0);
    }

    function checkTotalSiloBalancesWithGrownStalk(uint256 expected, uint256 grownStalk) public view {
        assertEq(bs.totalStalk(), expected * C.STALK_PER_BEAN + grownStalk,  "TotalStalk");
        assertEq(bs.totalRoots(), ((expected * C.STALK_PER_BEAN) + grownStalk) * C.getRootsBase(), "TotalRoots");
        assertEq(bs.getTotalDeposited(C.BEAN), expected, "TotalDeposited");
        assertEq(bs.getTotalDepositedBdv(C.BEAN), expected, "TotalDepositedBdv");
    }

    function checkFarmerSiloBalances(address farmer, uint256 expected) public view { 
        checkFarmerSiloBalancesWithGrownStalk(farmer, expected, 0);
    }

    function checkFarmerSiloBalancesWithGrownStalk(address farmer, uint256 expected, uint256 grownStalk) public view { 
        assertEq(bs.balanceOfStalk(farmer), (expected * C.STALK_PER_BEAN) + grownStalk, "FarmerStalk");
        assertEq(bs.balanceOfRoots(farmer), ((expected * C.STALK_PER_BEAN) + grownStalk) * C.getRootsBase(), "FarmerRoots");
    }

    function checkTotalGerminatingBalances(uint256 expected) public view {
        assertEq(bs.getTotalGerminatingStalk(), expected * C.STALK_PER_BEAN, "TotalGerminatingStalk");
        assertEq(bs.getGerminatingTotalDeposited(C.BEAN), expected, "getGerminatingTotalDeposited");
        assertEq(bs.getGerminatingTotalDepositedBdv(C.BEAN), expected, "getGerminatingTotalDepositedBdv");
    }

    function checkFarmerGerminatingBalances(address farmer, uint256 expected) public view {
        assertEq(bs.balanceOfGerminatingStalk(farmer), C.STALK_PER_BEAN * expected, "balanceOfGerminatingStalk");
    }
}