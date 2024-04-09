// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper} from "./utils/TestHelper.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockSiloFacet} from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import {MockPump} from "contracts/mocks/well/MockPump.sol";
import {ConvertFacet} from "contracts/beanstalk/silo/ConvertFacet.sol";
import {Bean} from "contracts/tokens/Bean.sol";
import {IWell, Call} from "contracts/interfaces/basin/IWell.sol";
import {FarmFacet} from "contracts/beanstalk/farm/FarmFacet.sol";
import {SeasonGettersFacet} from "contracts/beanstalk/sun/SeasonFacet/SeasonGettersFacet.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {Pipeline} from "contracts/pipeline/Pipeline.sol";
import {DepotFacet, AdvancedPipeCall} from "contracts/beanstalk/farm/DepotFacet.sol";
import {AdvancedFarmCall} from "contracts/libraries/LibFarm.sol";
import {SiloGettersFacet} from "contracts/beanstalk/silo/SiloFacet/SiloGettersFacet.sol";
import {C} from "contracts/C.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {ICappedReservesPump} from "contracts/interfaces/basin/pumps/ICappedReservesPump.sol";
import "forge-std/Test.sol";

/**
 * @title PipelineConvertTest
 * @author pizzaman1337
 * @notice Test pipeline convert.
 */
contract PipelineConvertTest is TestHelper {
    using SafeMath for uint256;

    // Interfaces.
    IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);
    MockSiloFacet silo = MockSiloFacet(BEANSTALK);
    ConvertFacet convert = ConvertFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
    DepotFacet depot = DepotFacet(BEANSTALK);
    FarmFacet farm = FarmFacet(BEANSTALK);
    SeasonGettersFacet seasonGetters = SeasonGettersFacet(BEANSTALK);
    SiloGettersFacet siloGetters = SiloGettersFacet(BEANSTALK);
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

    // Event defs

    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int96[] stems,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );

    event AddDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

  
    function setUp() public {
        
        initializeBeanstalkTestState(true, false);

        // initalize farmers.
        farmers.push(users[1]); 
        farmers.push(users[2]);
        
        // add inital liquidity to bean eth well:
        // prank beanstalk deployer (can be anyone)
        vm.prank(users[0]); 
        addInitialLiquidity(
            C.BEAN_ETH_WELL,
            10000e6, // 10,000 bean,
            10 ether  // 10 WETH
        );
        // mint 1000 beans to farmers (user 0 is the beanstalk deployer).
        mintTokensToUsers(farmers, C.BEAN,  MAX_DEPOSIT_BOUND);
    }

    //////////// DEPOSITS ////////////

    function testBasicConvertBeanToLP(uint256 amount) public {
        vm.pauseGasMetering();
        int96 stem;
        // well is initalized with 10000 beans. cap add liquidity 
        // to reasonable amounts. 
        amount = bound(amount, 10e6, 5000e6);
        // deposits bean into the silo.
        bean.mint(users[1], 5000e6);

        address[] memory setupUsers = new address[](1);
        setupUsers[0] = users[1];

        (amount, ) = setUpSiloDepositTest(amount, setupUsers);
        console.log('stem: ');
        console.logInt(stem);
        console.log('amount: ', amount);

        passGermination();

        // do the convert

        // Create arrays for stem and amount. Tried just passing in [stem] and it's like nope.
        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createBeanToLPFarmCalls(amount);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        // get well amount out if we deposit 200 beans
        uint256 wellAmountOut = getWellAmountOutForAddingBeans(amount);

        // verify convert
        vm.expectEmit(true, false, false, true);
        emit Convert(users[1], C.BEAN, C.BEAN_ETH_WELL, amount, wellAmountOut);

        // vm.expectEmit(true, false, false, true);
        // emit RemoveDeposits(users[1], C.BEAN, stems, amounts, amount, amounts);

        // get bdv of this well amount out for later comparison
        // FIXME: the well amount out reverts because pumps returning zero, maybe need a helper to update pumps?
        // uint256 bdvOfThisWellAmountOut = bs.bdv(C.BEAN_ETH_WELL, wellAmountOut);

        // vm.expectEmit(true, false, false, true);
        // emit AddDeposit(users[1], C.BEAN_ETH_WELL, stem, wellAmountOut, amount);

        
        vm.resumeGasMetering();
        vm.prank(users[1]); // do this as user 1
        convert.pipelineConvert(
            C.BEAN, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN_ETH_WELL, // token out
            farmCalls // farmData
        );

    }

    function getWellAmountOutForAddingBeans(uint256 amount) public view returns (uint256) {

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        amounts[1] = 0;

        uint256 wellAmountOut = IWell(C.BEAN_ETH_WELL).getAddLiquidityOut(amounts);
        return wellAmountOut;
    }

    function testBasicConvertLPToBean(uint256 amount) public {
        vm.pauseGasMetering();
        int96 stem;
        // well is initalized with 10000 beans. cap add liquidity 
        // to reasonable amounts. 
        amount = bound(amount, 1e6, 10000e6);

        // mint beans to user 1
        bean.mint(users[1], amount);
        // user 1 deposits bean into bean:eth well, first approve
        vm.prank(users[1]);
        bean.approve(C.BEAN_ETH_WELL, type(uint256).max);

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = amount;
        tokenAmountsIn[1] = 0;

        vm.prank(users[1]);
        uint256 lpAmountOut = IWell(C.BEAN_ETH_WELL).addLiquidity(tokenAmountsIn, 0, users[1], type(uint256).max);

        // approve spending well token to beanstalk
        vm.prank(users[1]);
        MockToken(C.BEAN_ETH_WELL).approve(BEANSTALK, type(uint256).max);

        vm.prank(users[1]);
        ( , , stem) = silo.deposit(C.BEAN_ETH_WELL, lpAmountOut, LibTransfer.From.EXTERNAL);


        passGermination();


        // Create arrays for stem and amount. Tried just passing in [stem] and it's like nope.
        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createLPToBeanFarmCalls(lpAmountOut);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = lpAmountOut;
        
        vm.resumeGasMetering();
        vm.prank(users[1]); // do this as user 1
        convert.pipelineConvert(
            C.BEAN_ETH_WELL, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN, // token out
            farmCalls // farmData
        );
    }

    function testDeltaBChangeBeanToLP(uint256 amount) public {
        amount = bound(amount, 1e6, 5000e6);
        int256 beforeDeltaB = seasonGetters.poolDeltaBInsta(C.BEAN_ETH_WELL);
        
        doBasicBeanToLP(amount, users[1]);

        int256 afterDeltaB = seasonGetters.poolDeltaBInsta(C.BEAN_ETH_WELL);
        assertTrue(afterDeltaB < beforeDeltaB);
        assertTrue(beforeDeltaB - int256(amount)*2 < afterDeltaB);
        // would be great to calcuate exactly what the new deltaB should be after convert
    }

    function testTotalStalkAmountDidNotIncrease(uint256 amount) public {
        amount = bound(amount, 1e6, 5000e6);
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        uint256 beforeTotalStalk = bs.totalStalk();
        beanToLPDoConvert(amount, stem, users[1]);

        uint256 afterTotalStalk = bs.totalStalk();
        assertTrue(afterTotalStalk <= beforeTotalStalk);
    }

    function testUserStalkAmountDidNotIncrease(uint256 amount) public {
        amount = bound(amount, 1e6, 5000e6);
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        uint256 beforeUserStalk = bs.balanceOfStalk(users[1]);
        beanToLPDoConvert(amount, stem, users[1]);

        uint256 afterUserStalk = bs.balanceOfStalk(users[1]);
        assertTrue(afterUserStalk <= beforeUserStalk);
    }

    function testUserBDVDidNotIncrease(uint256 amount) public {
        amount = bound(amount, 1e6, 5000e6);
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        uint256 beforeUserDeposit = bs.balanceOfDepositedBdv(users[1], C.BEAN);
        beanToLPDoConvert(amount, stem, users[1]);

        uint256 afterUserDeposit = bs.balanceOfDepositedBdv(users[1], C.BEAN);
        assertTrue(afterUserDeposit <= beforeUserDeposit);
    }

    function testConvertAgainstPegAndLoseStalk(uint256 amount) public {
        amount = bound(amount, 5000e6, 5000e6); // todo: update for range

        // get new deltaB
        int256 beforeDeltaB = seasonGetters.poolDeltaBInsta(C.BEAN_ETH_WELL);
        
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        // uint256 beforeTotalStalk = bs.totalStalk();
        uint256 grownStalkBefore = bs.balanceOfGrownStalk(users[1], C.BEAN);


        beanToLPDoConvert(amount, stem, users[1]);

        uint256 grownStalkAfter = bs.balanceOfGrownStalk(users[1], C.BEAN_ETH_WELL);

        assertTrue(grownStalkAfter == 0); // all grown stalk was lost
        assertTrue(grownStalkBefore > 0);
    }

    function testConvertWithPegAndKeepStalk(uint256 amount) public {
        amount = bound(amount, 5000e6, 5000e6); // todo: update for range

        // how many eth would we get if we swapped this amount in the well
        uint256 ethAmount = IWell(C.BEAN_ETH_WELL).getSwapOut(IERC20(C.BEAN), IERC20(C.WETH), amount);
        ethAmount = ethAmount.mul(2); // I need a better way to calculate how much eth out there should be to make sure we can swap and be over peg

        MockToken(C.WETH).mint(users[1], ethAmount);
        vm.prank(users[1]);
        MockToken(C.WETH).approve(C.BEAN_ETH_WELL, ethAmount);

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = 0;
        tokenAmountsIn[1] = ethAmount;

        vm.prank(users[1]);
        uint256 lpAmountOut = IWell(C.BEAN_ETH_WELL).addLiquidity(tokenAmountsIn, 0, users[1], type(uint256).max);

        // get new deltaB
        int256 beforeDeltaB = seasonGetters.poolDeltaBInsta(C.BEAN_ETH_WELL);
        
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        uint256 grownStalkBefore = bs.balanceOfGrownStalk(users[1], C.BEAN);


        beanToLPDoConvert(amount, stem, users[1]);

        uint256 totalStalkAfter = bs.balanceOfStalk(users[1]);

        // get balance of deposited bdv for this user
        uint256 bdvBalance = bs.balanceOfDepositedBdv(users[1], C.BEAN_ETH_WELL) * 1e4; // convert to stalk amount

        assertTrue(totalStalkAfter == bdvBalance + grownStalkBefore); // all grown stalk was lost
    }

    function testFlashloanManipulationLoseGrownStalkBecauseZeroConvertPower(uint256 amount) public {
        amount = bound(amount, 5000e6, 5000e6); // todo: update for range

        // the main idea is that we start at deltaB of zero, so converts should not be possible
        // we add eth to the well to push it over peg, then we convert our beans back down to lp
        // then we pull our initial eth back out and we converted when we shouldn't have been able to (if we do in one tx)

        // setup initial bean deposit
        int96 stem = beanToLPDepositSetup(amount, users[1]);

        // mint user 10 eth
        uint256 ethAmount = 10e18;
        MockToken(C.WETH).mint(users[1], ethAmount);

        vm.prank(users[1]);
        MockToken(C.WETH).approve(C.BEAN_ETH_WELL, ethAmount);

        // add liquidity to well
        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = 0;
        tokenAmountsIn[1] = ethAmount;

        vm.prank(users[1]);
        IWell(C.BEAN_ETH_WELL).addLiquidity(tokenAmountsIn, 0, users[1], type(uint256).max);

        uint256 grownStalkBefore = bs.balanceOfGrownStalk(users[1], C.BEAN);

        // convert beans to lp
        beanToLPDoConvert(amount, stem, users[1]);

        // it should be that we lost our grown stalk from this convert

        uint256 grownStalkAfter = bs.balanceOfGrownStalk(users[1], C.BEAN_ETH_WELL);

        assertTrue(grownStalkAfter == 0); // all grown stalk was lost
        assertTrue(grownStalkBefore > 0);
    }

    // double convert uses up convert power so we should be left at no grown stalk after second convert
    // (but still have grown stalk after first convert)
    function testFlashloanManipulationLoseGrownStalkBecauseDoubleConvert(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6); // todo: update for range

        // do initial pump update
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        // the main idea is that we start some positive deltaB, so a limited amount of converts are possible (1.2 eth worth)
        // User One does a convert down, and that uses up convert power for this block
        // someone adds more eth to the well, which means we're back too far over peg
        // then User Two tries to do a convert down, but at that point the convert power has been used up, so they lose their grown stalk

        // setup initial bean deposit
        int96 stem = beanToLPDepositSetup(amount, users[1]);

        // then setup a convert from user 2
        int96 stem2 = beanToLPDepositSetup(amount, users[2]);

        // if you deposited amount of beans into well, how many eth would you get?
        uint256 ethAmount = IWell(C.BEAN_ETH_WELL).getSwapOut(IERC20(C.BEAN), IERC20(C.WETH), amount);

        ethAmount = ethAmount.mul(12000).div(10000); // I need a better way to calculate how much eth out there should be to make sure we can swap and be over peg

        addEthToWell(users[1], ethAmount);
        
        // go to next block
        vm.roll(block.number + 1);

        uint256 grownStalkBefore = bs.balanceOfGrownStalk(users[2], C.BEAN);

        // update pump
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        convert.cappedReservesDeltaB(C.BEAN_ETH_WELL);

        uint256 convertPowerStage1 = convert.getConvertPower();

        // convert beans to lp
        beanToLPDoConvert(amount, stem, users[1]);

        uint256 convertPowerStage2 = convert.getConvertPower();
        assertTrue(convertPowerStage2 < convertPowerStage1);

        // add more eth to well again
        addEthToWell(users[1], ethAmount);

        beanToLPDoConvert(amount, stem2, users[2]);

        uint256 convertPowerStage3 = convert.getConvertPower();
        assertTrue(convertPowerStage3 < convertPowerStage2);

        uint256 grownStalkAfter = bs.balanceOfGrownStalk(users[2], C.BEAN_ETH_WELL);

        assertTrue(grownStalkAfter == 0); // all grown stalk was lost because no convert power left
        assertTrue(grownStalkBefore > 0);
    }



    function testCalculateStalkPenaltyUpwardsToZero() public {
        int256 beforeDeltaB = -100;
        int256 afterDeltaB = 0;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 100;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyUpwardsNonZero() public {
        int256 beforeDeltaB = -200;
        int256 afterDeltaB = -100;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 100;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyDownwardsToZero() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 0;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 100;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyDownwardsNonZero() public {
        int256 beforeDeltaB = 200;
        int256 afterDeltaB = 100;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 100;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyCrossPegUpward() public {
        int256 beforeDeltaB = -50;
        int256 afterDeltaB = 50;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 50;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyCrossPegDownward() public {
        int256 beforeDeltaB = 50;
        int256 afterDeltaB = -50;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 50;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyNoCappedDeltaB() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 0;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 0;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 100);
    }

    function testCalculateStalkPenaltyNoCappedDeltaBNotZero() public {
        int256 beforeDeltaB = 101;
        int256 afterDeltaB = 1;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 0;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 100);
    }

    function testCalculateStalkPenaltyNoCappedDeltaBNotZeroHalf() public {
        int256 beforeDeltaB = 101;
        int256 afterDeltaB = 1;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 50;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyNoCappedDeltaBToZeroHalf() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 0;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 50;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyLPtoLPSmallSlippage() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 101;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 100;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 1);
    }

    function testCalculateStalkPenaltyLPtoLPLargeSlippageNoCapped() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 151;
        uint256[] memory bdvsRemoved = new uint256[](1);
        bdvsRemoved[0] = 100;
        uint256 cappedDeltaB = 0;
        uint256 penalty = convert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
        assertEq(penalty, 51);
    }


    ////// SILO TEST HELPERS //////

    function updateMockPumpUsingWellReserves(address well) public {
        Call[] memory pumps = IWell(well).pumps();
        for (uint i = 0; i < pumps.length; i++) {
            address pump = pumps[i].target;
            // pass to the pump the reserves that we actually have in the well
            uint[] memory reserves = IWell(well).getReserves();
            MockPump(pump).update(reserves, new bytes(0));
        }
    }

    function doBasicBeanToLP(uint256 amount, address user) public {
        int96 stem = beanToLPDepositSetup(amount, user);
        beanToLPDoConvert(amount, stem, user);
    }

    function beanToLPDepositSetup(uint256 amount, address user) public returns (int96 stem) {
        vm.pauseGasMetering();
        // amount = bound(amount, 1e6, 5000e6);
        bean.mint(user, amount);

        // setup array of addresses with user
        address[] memory users = new address[](1);
        users[0] = user;

        (amount, stem) = setUpSiloDepositTest(amount, users);

        passGermination();
    }

    function beanToLPDoConvert(uint256 amount, int96 stem, address user) public 
        returns (int96[] memory outputStems, uint256[] memory outputAmounts) {
        // do the convert

        // Create arrays for stem and amount. Tried just passing in [stem] and it's like nope.
        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createBeanToLPFarmCalls(amount);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        vm.resumeGasMetering();
        vm.prank(user); // do this as user 1
        (outputStems, outputAmounts) = convert.pipelineConvert(
            C.BEAN, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN_ETH_WELL, // token out
            farmCalls // farmData
        );
    }

    function lpToBeanDoConvert(uint256 lpAmountOut, int96 stem, address user) public
        returns (int96[] memory outputStems, uint256[] memory outputAmounts) {
        // Create arrays for stem and amount. Tried just passing in [stem] and it's like nope.
        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createLPToBeanFarmCalls(lpAmountOut);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = lpAmountOut;
        
        vm.resumeGasMetering();
        vm.prank(user); // do this as user 1
        (outputStems, outputAmounts) = convert.pipelineConvert(
            C.BEAN_ETH_WELL, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN, // token out
            farmCalls // farmData
        );
    }

    function addEthToWell(address user, uint256 amount) public returns (uint256 lpAmountOut) {
        MockToken(C.WETH).mint(user, amount);

        vm.prank(user);
        MockToken(C.WETH).approve(C.BEAN_ETH_WELL, amount);

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = 0;
        tokenAmountsIn[1] = amount;

        vm.prank(user);
        lpAmountOut = IWell(C.BEAN_ETH_WELL).addLiquidity(tokenAmountsIn, 0, user, type(uint256).max);

        // approve spending well token to beanstalk
        vm.prank(user);
        MockToken(C.BEAN_ETH_WELL).approve(BEANSTALK, type(uint256).max);
    }


    function passGermination() public {
        // call sunrise twice to end the germination process.
        season.siloSunrise(0);
        season.siloSunrise(0);
    }


    /**
     * @notice assumes a CP2 well with bean as one of the tokens.
     */
    function addInitialLiquidity(
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal { 
        (address nonBeanToken, ) = LibWell.getNonBeanTokenAndIndexFromWell(
            well
        );
        
        // mint and sync.
        MockToken(C.BEAN).mint(well, beanAmount);
        MockToken(nonBeanToken).mint(well, nonBeanTokenAmount);

        IWell(well).sync(msg.sender, 0);
    }

    /**
     * @notice Set up the silo deposit test by depositing beans to the silo from multiple users.
     * @param amount The amount of beans to deposit.
     * @return _amount The actual amount of beans deposited.
     * @return stem The stem tip for the deposited beans.
     */
    function setUpSiloDepositTest(uint256 amount, address[] memory _farmers) public returns (uint256 _amount, int96 stem) {
        _amount = bound(amount, 1, MAX_DEPOSIT_BOUND);

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

    function createBeanToLPFarmCalls(
        uint256 amountOfBean
    ) public returns (AdvancedFarmCall[] memory output) {
        // first setup the pipeline calls

        // setup approve max call
        bytes memory approveEncoded = abi.encodeWithSelector(
            IERC20.approve.selector,
            C.BEAN_ETH_WELL,
            MAX_UINT256
        );

        uint256[] memory tokenAmountsIn = new uint256[](2); 
        tokenAmountsIn[0] = amountOfBean;
        tokenAmountsIn[1] = 0;

        // encode Add liqudity.
        bytes memory addLiquidityEncoded = abi.encodeWithSelector(
            IWell.addLiquidity.selector,
            tokenAmountsIn, // tokenAmountsIn
            0, // min out
            C.PIPELINE, // recipient
            type(uint256).max // deadline
        );

        // Fabricate advancePipes: 
        AdvancedPipeCall[] memory advancedPipeCalls = new AdvancedPipeCall[](2);
        
        // Action 0: approve the Bean-Eth well to spend pipeline's bean.
        advancedPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            approveEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // Action 2: Add One sided Liquidity into the well. 
        advancedPipeCalls[1] = AdvancedPipeCall(
            C.BEAN_ETH_WELL, // target
            addLiquidityEncoded, // calldata
            abi.encode(0) // clipboard
        );


        // Encode into a AdvancedFarmCall. NOTE: advancedFarmCall != advancedPipeCall. 
        
        // AdvancedFarmCall calls any function on the beanstalk diamond. 
        // advancedPipe is one of the functions that its calling. 
        // AdvancedFarmCall cannot call approve/addLiquidity, but can call AdvancedPipe.
        // AdvancedPipe can call any arbitrary function.
        AdvancedFarmCall[] memory advancedFarmCalls = new AdvancedFarmCall[](1);
        
        bytes memory advancedPipeCalldata = 
            abi.encodeWithSelector(
                depot.advancedPipe.selector,
                advancedPipeCalls,
                0
            );

        advancedFarmCalls[0] = AdvancedFarmCall(advancedPipeCalldata, new bytes(0));

        // encode into bytes. 
        // output = abi.encode(advancedFarmCalls);
        return advancedFarmCalls;
    }

    function createLPToBeanFarmCalls(
        uint256 amountOfLP
    ) public returns (AdvancedFarmCall[] memory output) {
        console.log('createLPToBean amountOfLP: ', amountOfLP);
        // first setup the pipeline calls

        // setup approve max call
        bytes memory approveEncoded = abi.encodeWithSelector(
            IERC20.approve.selector,
            C.BEAN_ETH_WELL,
            MAX_UINT256
        );

        uint256[] memory tokenAmountsIn = new uint256[](2); 
        tokenAmountsIn[0] = amountOfLP;
        tokenAmountsIn[1] = 0;

        // encode remove liqudity.
        bytes memory removeLiquidityEncoded = abi.encodeWithSelector(
            IWell.removeLiquidityOneToken.selector,
            amountOfLP, // tokenAmountsIn
            C.BEAN, // tokenOut
            0, // min out
            C.PIPELINE, // recipient
            type(uint256).max // deadline
        );

        // Fabricate advancePipes: 
        AdvancedPipeCall[] memory advancedPipeCalls = new AdvancedPipeCall[](2);
        
        // Action 0: approve the Bean-Eth well to spend pipeline's bean.
        advancedPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            approveEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // Action 2: Add One sided Liquidity into the well. 
        advancedPipeCalls[1] = AdvancedPipeCall(
            C.BEAN_ETH_WELL, // target
            removeLiquidityEncoded, // calldata
            abi.encode(0) // clipboard
        );


        // Encode into a AdvancedFarmCall. NOTE: advancedFarmCall != advancedPipeCall. 
        
        // AdvancedFarmCall calls any function on the beanstalk diamond. 
        // advancedPipe is one of the functions that its calling. 
        // AdvancedFarmCall cannot call approve/addLiquidity, but can call AdvancedPipe.
        // AdvancedPipe can call any arbitrary function.
        AdvancedFarmCall[] memory advancedFarmCalls = new AdvancedFarmCall[](1);
        
        bytes memory advancedPipeCalldata = 
            abi.encodeWithSelector(
                depot.advancedPipe.selector,
                advancedPipeCalls,
                0
            );

        advancedFarmCalls[0] = AdvancedFarmCall(advancedPipeCalldata, new bytes(0));

        // encode into bytes. 
        // output = abi.encode(advancedFarmCalls);
        return advancedFarmCalls;
    }
}