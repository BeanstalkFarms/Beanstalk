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
import {ConvertGettersFacet} from "contracts/beanstalk/silo/ConvertGettersFacet.sol";
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
import {LibClipboard} from "contracts/libraries/LibClipboard.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import "forge-std/Test.sol";

contract MiscHelperContract {
    function returnNumber(uint256 num) public pure returns (uint256) {
        return num;
    }
}

/**
 * @title PipelineConvertTest
 * @author pizzaman1337
 * @notice Test pipeline convert.
 */
contract PipelineConvertTest is TestHelper {
    using SafeMath for uint256;

    // Interfaces.
    // IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);
    MockSiloFacet silo = MockSiloFacet(BEANSTALK);
    ConvertFacet convert = ConvertFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
    DepotFacet depot = DepotFacet(BEANSTALK);
    FarmFacet farm = FarmFacet(BEANSTALK);
    SeasonGettersFacet seasonGetters = SeasonGettersFacet(BEANSTALK);
    ConvertGettersFacet convertGetters = ConvertGettersFacet(BEANSTALK);
    SiloGettersFacet siloGetters = SiloGettersFacet(BEANSTALK);
    MockToken bean = MockToken(C.BEAN);
    MockToken beanEthWell = MockToken(C.BEAN_ETH_WELL);
    Pipeline pipeline = Pipeline(PIPELINE);
    MiscHelperContract miscHelper = new MiscHelperContract();

    
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

        addInitialLiquidity(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 bean,
            10 ether  // 10 WETH of wstETH
        );

        // mint 1000 beans to farmers (user 0 is the beanstalk deployer).
        mintTokensToUsers(farmers, C.BEAN,  MAX_DEPOSIT_BOUND);
    }

    //////////// CONVERTS ////////////

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

        (amount, stem) = setUpSiloDepositTest(amount, setupUsers);
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

    function testBasicConvertLPToBean(uint256 amount) public {
        vm.pauseGasMetering();

        // well is initalized with 10000 beans. cap add liquidity 
        // to reasonable amounts. 
        amount = bound(amount, 1e6, 10000e6);

        (int96 stem, uint256 lpAmountOut) = depositLPAndPassGermination(amount);


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

    function testBasicConvertLPToLP(uint256 amount) public {
        vm.pauseGasMetering();

        // well is initalized with 10000 beans. cap add liquidity 
        // to reasonable amounts.
        amount = bound(amount, 1e6, 5000e6);

        (int96 stem, uint256 lpAmountOut) = depositLPAndPassGermination(amount);

        mineBlockAndUpdatePumps();

        // log deltaB for this well before convert
        int256 beforeDeltaBEth = seasonGetters.poolCurrentDeltaB(C.BEAN_ETH_WELL);
        int256 beforeDeltaBwsteth = seasonGetters.poolCurrentDeltaB(C.BEAN_WSTETH_WELL);

        // uint256 beforeGrownStalk = bs.balanceOfGrownStalk(users[1], C.BEAN_ETH_WELL);
        uint256 beforeBalanceOfStalk = bs.balanceOfStalk(users[1]);

        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory lpToLPFarmCalls = createLPToLPFarmCalls(lpAmountOut);
        farmCalls[0] = lpToLPFarmCalls[0]; // Assign the first element of the returned array


        uint256[] memory amounts = new uint256[](1);
        amounts[0] = lpAmountOut;
        
        vm.resumeGasMetering();
        vm.prank(users[1]);

        convert.pipelineConvert(
            C.BEAN_ETH_WELL, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN_WSTETH_WELL, // token out
            farmCalls // farmData
        );
    
        int256 afterDeltaBEth = seasonGetters.poolCurrentDeltaB(C.BEAN_ETH_WELL);
        int256 afterDeltaBwsteth = seasonGetters.poolCurrentDeltaB(C.BEAN_WSTETH_WELL);

        // make sure deltaB's moved in the way we expect them to
        assertTrue(beforeDeltaBEth < afterDeltaBEth);
        assertTrue(afterDeltaBwsteth < beforeDeltaBwsteth);

        uint256 totalStalkAfter = bs.balanceOfStalk(users[1]);

        // since we didn't cross peg and there was convert power, we expect full remaining grown stalk
        // (plus a little from the convert benefit)
        assertTrue(totalStalkAfter >= beforeBalanceOfStalk);
    }


    function testUpdatingOverallDeltaB(uint256 amount) public {
        amount = bound(amount, 1e6, 5000e6);
        depositLPAndPassGermination(amount);
        mineBlockAndUpdatePumps();

        int256 overallCappedDeltaB = convertGetters.overallCappedDeltaB();
        assertTrue(overallCappedDeltaB != 0);
    }


    function testDeltaBChangeBeanToLP(uint256 amount) public {
        amount = bound(amount, 1e6, 5000e6);
        int256 beforeDeltaB = seasonGetters.poolCurrentDeltaB(C.BEAN_ETH_WELL);
        
        doBasicBeanToLP(amount, users[1]);

        int256 afterDeltaB = seasonGetters.poolCurrentDeltaB(C.BEAN_ETH_WELL);
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
        
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        // uint256 beforeTotalStalk = bs.totalStalk();
        uint256 grownStalkBefore = bs.balanceOfGrownStalk(users[1], C.BEAN);


        beanToLPDoConvert(amount, stem, users[1]);

        uint256 grownStalkAfter = bs.balanceOfGrownStalk(users[1], C.BEAN_ETH_WELL);

        assertTrue(grownStalkAfter == 0); // all grown stalk was lost
        assertTrue(grownStalkBefore > 0);
    }

    /*function testConvertWithPegAndKeepStalk(uint256 amount) public {
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
        int256 beforeDeltaB = seasonGetters.poolCurrentDeltaB(C.BEAN_ETH_WELL);
        
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        uint256 grownStalkBefore = bs.balanceOfGrownStalk(users[1], C.BEAN);


        beanToLPDoConvert(amount, stem, users[1]);

        uint256 totalStalkAfter = bs.balanceOfStalk(users[1]);

        // get balance of deposited bdv for this user
        uint256 bdvBalance = bs.balanceOfDepositedBdv(users[1], C.BEAN_ETH_WELL) * 1e4; // convert to stalk amount

        assertTrue(totalStalkAfter == bdvBalance + grownStalkBefore); // all grown stalk was lost
    }*/

    function testFlashloanManipulationLoseGrownStalkBecauseZeroConvertCapacity(uint256 amount) public {
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
    /*function testFlashloanManipulationLoseGrownStalkBecauseDoubleConvert(uint256 amount) public {
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

        // convert.cappedReservesDeltaB(C.BEAN_ETH_WELL);

        uint256 convertCapacityStage1 = convert.getConvertCapacity();

        // convert beans to lp
        beanToLPDoConvert(amount, stem, users[1]);

        uint256 convertCapacityStage2 = convert.getConvertCapacity();
        assertTrue(convertCapacityStage2 < convertCapacityStage1);

        // add more eth to well again
        addEthToWell(users[1], ethAmount);

        beanToLPDoConvert(amount, stem2, users[2]);

        uint256 convertCapacityStage3 = convert.getConvertCapacity();
        assertTrue(convertCapacityStage3 < convertCapacityStage2);

        uint256 grownStalkAfter = bs.balanceOfGrownStalk(users[2], C.BEAN_ETH_WELL);

        assertTrue(grownStalkAfter == 0); // all grown stalk was lost because no convert power left
        assertTrue(grownStalkBefore > 0);
    }*/

    function testConvertingOutputTokenNotWell(uint256 amount) public {
        amount = bound(amount, 1, 1000e6);
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createBeanToLPFarmCalls(amount);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array
        vm.expectRevert("Convert: Output token must be Bean or a well");
        // convert non-whitelisted asset to lp
        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.UNRIPE_LP, // token out
            farmCalls // farmData
        );
    }

    function testConvertingInputTokenNotWell(uint256 amount) public {
        amount = bound(amount, 1, 1000e6);
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createBeanToLPFarmCalls(amount);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array
        vm.expectRevert("Convert: Input token must be Bean or a well");
        // convert non-whitelisted asset to lp
        vm.prank(users[1]);
        convert.pipelineConvert(
            C.UNRIPE_LP, // input token
            stems, // stem
            amounts, // amount
            C.BEAN, // token out
            farmCalls // farmData
        );
    }

    // test that leaves less ERC20 in the pipeline than is returned by the final function
    // no longer necessary since we now check how many tokens were left in pipeline, leaving here in case it can be repurposed
    /*function testNotEnoughTokensLeftInPipeline(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6);
        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256 returnThisNumber = 5000e22;

        bytes memory returnNumberEncoded = abi.encodeWithSelector(
            MiscHelperContract.returnNumber.selector,
            returnThisNumber
        );

        // create extra pipe calls
        AdvancedPipeCall[] memory extraPipeCalls = new AdvancedPipeCall[](1);
        // extra call will be to a function that returns a big number (more than amoutn of LP left in pipeline)
        extraPipeCalls[0] = AdvancedPipeCall(
            address(miscHelper), // target
            returnNumberEncoded, // calldata
            abi.encode(0) // clipboard
        );

        AdvancedFarmCall[] memory farmCalls = new AdvancedFarmCall[](1);
        AdvancedFarmCall[] memory beanToLPFarmCalls = createBeanToLPFarmCalls(amount, extraPipeCalls);
        farmCalls[0] = beanToLPFarmCalls[0]; // Assign the first element of the returned array

        vm.expectRevert("ERC20: transfer amount exceeds balance");

        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.BEAN_ETH_WELL, // token out
            farmCalls // farmData
        );
    }*/

    function testBeanToBeanConvert(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6);

        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;


        uint256 stalkBefore = bs.balanceOfStalk(users[1]);
        uint256 grownStalk = bs.grownStalkForDeposit(users[1], C.BEAN, stem);

        // make a pipeline call where the only thing it does is return how many beans are in pipeline
        bytes memory callEncoded = abi.encodeWithSelector(bean.balanceOf.selector, C.PIPELINE);
        AdvancedPipeCall[] memory extraPipeCalls = new AdvancedPipeCall[](1);
        extraPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            callEncoded, // calldata
            abi.encode(0) // clipboard
        );

        AdvancedFarmCall[] memory farmCalls = createAdvancedFarmCallsFromAdvancedPipeCalls(extraPipeCalls);

        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.BEAN, // token out
            farmCalls
        );

        uint256 stalkAfter = bs.balanceOfStalk(users[1]);
        assertEq(stalkAfter, stalkBefore+grownStalk);
    }

    // half of the bdv is extracted during the convert, stalk/bdv of deposits should be correct on output
    function testBeanToBeanConvertLessBdv(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6);

        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256 stalkBefore = bs.balanceOfStalk(users[1]);
        uint256 grownStalk = bs.grownStalkForDeposit(users[1], C.BEAN, stem);
        uint256 bdvBefore = bs.balanceOfDepositedBdv(users[1], C.BEAN);

        // make a pipeline call where the only thing it does is return how many beans are in pipeline
        AdvancedPipeCall[] memory extraPipeCalls = new AdvancedPipeCall[](1);

        // send half our beans from pipeline to Vitalik address (for some reason zero address gave an evm error)
        bytes memory sendBeans = abi.encodeWithSelector(bean.transfer.selector, 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, amount.div(2));
        extraPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            sendBeans, // calldata
            abi.encode(0) // clipboard
        );

        AdvancedFarmCall[] memory farmCalls = createAdvancedFarmCallsFromAdvancedPipeCalls(extraPipeCalls);

        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.BEAN, // token out
            farmCalls
        );

        uint256 stalkAfter = bs.balanceOfStalk(users[1]);
        assertEq(stalkAfter, stalkBefore.div(2)+grownStalk);

        uint256 bdvAfter = bs.balanceOfDepositedBdv(users[1], C.BEAN);
        assertEq(bdvAfter, bdvBefore.div(2));
    }

    // adds 50% more beans to the pipeline so we get extra bdv after convert
    function testBeanToBeanConvertMoreBdv(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6);

        // mint extra beans to pipeline so we can snatch them on convert back into beanstalk
        bean.mint(C.PIPELINE, amount.div(2));

        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256 stalkBefore = bs.balanceOfStalk(users[1]);
        uint256 grownStalk = bs.grownStalkForDeposit(users[1], C.BEAN, stem);
        uint256 bdvBefore = bs.balanceOfDepositedBdv(users[1], C.BEAN);

        // make a pipeline call where the only thing it does is return how many beans are in pipeline
        AdvancedPipeCall[] memory extraPipeCalls = new AdvancedPipeCall[](1);

        bytes memory callEncoded = abi.encodeWithSelector(bean.balanceOf.selector, C.PIPELINE);
        extraPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            callEncoded, // calldata
            abi.encode(0) // clipboard
        );

        AdvancedFarmCall[] memory farmCalls = createAdvancedFarmCallsFromAdvancedPipeCalls(extraPipeCalls);

        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.BEAN, // token out
            farmCalls
        );

        uint256 stalkAfter = bs.balanceOfStalk(users[1]);
        assertEq(stalkAfter, stalkBefore+stalkBefore.div(2)+grownStalk);

        uint256 bdvAfter = bs.balanceOfDepositedBdv(users[1], C.BEAN);
        assertEq(bdvAfter, bdvBefore+bdvBefore.div(2));
    }

    function testBeanToBeanConvertNoneLeftInPipeline(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6);

        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        AdvancedPipeCall[] memory extraPipeCalls = new AdvancedPipeCall[](1);

        // send all our beans away
        bytes memory sendBeans = abi.encodeWithSelector(bean.transfer.selector, 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, amount);
        extraPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            sendBeans, // calldata
            abi.encode(0) // clipboard
        );

        AdvancedFarmCall[] memory farmCalls = createAdvancedFarmCallsFromAdvancedPipeCalls(extraPipeCalls);

        vm.expectRevert("Convert: No output tokens left in pipeline");
        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.BEAN, // token out
            farmCalls
        );
    }

    // test bean to bean convert, but deltaB is affected against them and there is convert power left in the block
    // because the deltaB of "bean" is not affected, no stalk loss should occur
    /*function testBeanToBeanConvertAffectDeltaB(uint256 amount) public {
        amount = bound(amount, 1000e6, 1000e6);

        int96 stem = beanToLPDepositSetup(amount, users[1]);
        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        // mint a weth to pipeline for later use
        uint256 ethAmount = 1 ether;
        MockToken(C.WETH).mint(C.PIPELINE, ethAmount);

        addEthToWell(users[1], 1 ether);

        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        // move foward 10 seasons so we have grown stalk
        season.siloSunrise(10);

        // store stalk before
        uint256 beforeStalk = bs.balanceOfStalk(users[1]) + bs.grownStalkForDeposit(users[1], C.BEAN, stem);

        // make a pipeline call where the only thing it does is return how many beans are in pipeline
        AdvancedPipeCall[] memory extraPipeCalls = new AdvancedPipeCall[](2);

        bytes memory approveWell = abi.encodeWithSelector(
            IERC20.approve.selector,
            C.BEAN_ETH_WELL,
            ethAmount
        );
        extraPipeCalls[0] = AdvancedPipeCall(
            C.WETH, // target
            approveWell, // calldata
            abi.encode(0) // clipboard
        );

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = 0;
        tokenAmountsIn[1] = ethAmount;

        // add a weth to the well to affect deltaB
        bytes memory addWeth = abi.encodeWithSelector(
            IWell(C.BEAN_ETH_WELL).addLiquidity.selector,
            tokenAmountsIn,
            0,
            C.PIPELINE,
            type(uint256).max
        );
        extraPipeCalls[1] = AdvancedPipeCall(
            C.BEAN_ETH_WELL, // target
            addWeth, // calldata
            abi.encode(0) // clipboard
        );

        AdvancedFarmCall[] memory farmCalls = createAdvancedFarmCallsFromAdvancedPipeCalls(extraPipeCalls);

        vm.prank(users[1]);
        convert.pipelineConvert(
            C.BEAN, // input token
            stems, // stem
            amounts, // amount
            C.BEAN, // token out
            farmCalls
        );

        // after stalk
        uint256 afterStalk = bs.balanceOfStalk(users[1]);

        // check that the deltaB is correct
        assertEq(afterStalk, beforeStalk);
    }*/


    // bonus todo: setup a test that reads remaining convert power from block and uses it when determining how much to convert
    // there are already tests that exercise depleting convert power, but might be cool to show how you can use it in a convert

    function testAmountAgainstPeg() public {
        uint256 amountAgainstPeg;
        uint256 crossoverAmount;

        (amountAgainstPeg) = LibConvert.calculateAmountAgainstPeg(-500, -400);
        assertEq(amountAgainstPeg, 0);

        (amountAgainstPeg) = LibConvert.calculateAmountAgainstPeg(-100, 0);
        assertEq(amountAgainstPeg, 0);

        (amountAgainstPeg) = LibConvert.calculateAmountAgainstPeg(100, 0);
        assertEq(amountAgainstPeg, 0);

        (amountAgainstPeg) = LibConvert.calculateAmountAgainstPeg(1, 101);
        assertEq(amountAgainstPeg, 100);

        (amountAgainstPeg) = LibConvert.calculateAmountAgainstPeg(0, 100);
        assertEq(amountAgainstPeg, 100);

        (amountAgainstPeg) = LibConvert.calculateAmountAgainstPeg(0, -100);
        assertEq(amountAgainstPeg, 100);
    }

    function testCalculateConvertedTowardsPeg() public {
        int256 beforeDeltaB = -100;
        int256 afterDeltaB = 0;
        uint256 amountInDirectionOfPeg = LibConvert.calculateConvertedTowardsPeg(beforeDeltaB, afterDeltaB);
        assertEq(amountInDirectionOfPeg, 100);

        beforeDeltaB = 100;
        afterDeltaB = 0;
        amountInDirectionOfPeg = LibConvert.calculateConvertedTowardsPeg(beforeDeltaB, afterDeltaB);
        assertEq(amountInDirectionOfPeg, 100);

        beforeDeltaB = -50;
        afterDeltaB = 50;
        amountInDirectionOfPeg = LibConvert.calculateConvertedTowardsPeg(beforeDeltaB, afterDeltaB);
        assertEq(amountInDirectionOfPeg, 50);

        beforeDeltaB = 50;
        afterDeltaB = -50;
        amountInDirectionOfPeg = LibConvert.calculateConvertedTowardsPeg(beforeDeltaB, afterDeltaB);
        assertEq(amountInDirectionOfPeg, 50);

        beforeDeltaB = 0;
        afterDeltaB = 100;
        amountInDirectionOfPeg = LibConvert.calculateConvertedTowardsPeg(beforeDeltaB, afterDeltaB);
        assertEq(amountInDirectionOfPeg, 0);

        beforeDeltaB = 0;
        afterDeltaB = -100;
        amountInDirectionOfPeg = LibConvert.calculateConvertedTowardsPeg(beforeDeltaB, afterDeltaB);
        assertEq(amountInDirectionOfPeg, 0);
    }

    function testCalculateStalkPenaltyUpwardsToZero() public {
        addEthToWell(users[1], 1 ether);
        // Update the pump so that eth added above is reflected.
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        LibConvert.DeltaBStorage memory dbs;
        dbs.beforeOverallDeltaB = -100;
        dbs.afterOverallDeltaB = 0;
        dbs.beforeInputTokenDeltaB = -100;
        dbs.afterInputTokenDeltaB = 0;
        dbs.beforeOutputTokenDeltaB = 0;
        dbs.afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallConvertCapacity = 100;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            dbs,
            bdvConverted,
            overallConvertCapacity,
            inputToken,
            outputToken
        );
        assertEq(penalty, 0);
    }

    function testCalculateConvertCapacityPenalty() public {
        addEthToWell(users[1], 1 ether);
        // Update the pump so that eth added above is reflected.
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);

        uint256 overallCappedDeltaB = 100;
        uint256 overallAmountInDirectionOfPeg = 100;
        address inputToken = C.BEAN_ETH_WELL;
        uint256 inputTokenAmountInDirectionOfPeg = 100;
        address outputToken = C.BEAN;
        uint256 outputTokenAmountInDirectionOfPeg = 100;
        uint256 penalty = LibConvert.calculateConvertCapacityPenalty(
            overallCappedDeltaB,
            overallAmountInDirectionOfPeg,
            inputToken,
            inputTokenAmountInDirectionOfPeg,
            outputToken,
            outputTokenAmountInDirectionOfPeg
        );
        assertEq(penalty, 0);

        // test with zero capped deltaB
        overallCappedDeltaB = 0;
        overallAmountInDirectionOfPeg = 100;
        inputToken = C.BEAN_ETH_WELL;
        inputTokenAmountInDirectionOfPeg = 100;
        outputToken = C.BEAN;
        outputTokenAmountInDirectionOfPeg = 100;
        penalty = LibConvert.calculateConvertCapacityPenalty(
            overallCappedDeltaB,
            overallAmountInDirectionOfPeg,
            inputToken,
            inputTokenAmountInDirectionOfPeg,
            outputToken,
            outputTokenAmountInDirectionOfPeg
        );
        assertEq(penalty, 100);

        // test with zero overall amount in direction of peg
        overallCappedDeltaB = 100;
        overallAmountInDirectionOfPeg = 0;
        inputToken = C.BEAN_ETH_WELL;
        inputTokenAmountInDirectionOfPeg = 0;
        outputToken = C.BEAN;
        outputTokenAmountInDirectionOfPeg = 0;
        penalty = LibConvert.calculateConvertCapacityPenalty(
            overallCappedDeltaB,
            overallAmountInDirectionOfPeg,
            inputToken,
            inputTokenAmountInDirectionOfPeg,
            outputToken,
            outputTokenAmountInDirectionOfPeg
        );
        assertEq(penalty, 0);




    }

    function testCalculateConvertCapacityPenaltyCapZeroInputToken() public {
        // test with input token zero convert capacity
        uint256 overallCappedDeltaB = 100;
        uint256 overallAmountInDirectionOfPeg = 100;
        address inputToken = C.BEAN_ETH_WELL;
        uint256 inputTokenAmountInDirectionOfPeg = 100;
        address outputToken = C.BEAN;
        uint256 outputTokenAmountInDirectionOfPeg = 0;
        uint256 penalty = LibConvert.calculateConvertCapacityPenalty(
            overallCappedDeltaB,
            overallAmountInDirectionOfPeg,
            inputToken,
            inputTokenAmountInDirectionOfPeg,
            outputToken,
            outputTokenAmountInDirectionOfPeg
        );
        assertEq(penalty, 100);
    }

    function testCalculateConvertCapacityPenaltyCapZeroOutputToken() public {
        // test with input token zero convert capacity
        uint256 overallCappedDeltaB = 100;
        uint256 overallAmountInDirectionOfPeg = 100;
        address inputToken = C.BEAN;
        uint256 inputTokenAmountInDirectionOfPeg = 0;
        address outputToken = C.BEAN_ETH_WELL;
        uint256 outputTokenAmountInDirectionOfPeg = 100;
        uint256 penalty = LibConvert.calculateConvertCapacityPenalty(
            overallCappedDeltaB,
            overallAmountInDirectionOfPeg,
            inputToken,
            inputTokenAmountInDirectionOfPeg,
            outputToken,
            outputTokenAmountInDirectionOfPeg
        );
        assertEq(penalty, 100);
    }

/*
    function testCalculateStalkPenaltyUpwardsToZero() public {
        int256 beforeOverallDeltaB = -100;
        int256 afterOverallDeltaB = 0;
        int256 beforeInputTokenDeltaB = -100;
        int256 beforeOutputTokenDeltaB = 0;
        int256 afterInputTokenDeltaB = 0;
        int256 afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallCappedDeltaB = 100;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            beforeOverallDeltaB,
            afterOverallDeltaB,
            beforeInputTokenDeltaB,
            beforeOutputTokenDeltaB,
            afterInputTokenDeltaB,
            afterOutputTokenDeltaB,
            bdvConverted,
            overallCappedDeltaB,
            inputToken,
            outputToken
        );
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyUpwardsNonZero() public {
        int256 beforeOverallDeltaB = -200;
        int256 afterOverallDeltaB = -100;
        int256 beforeInputTokenDeltaB = -100;
        int256 beforeOutputTokenDeltaB = 0;
        int256 afterInputTokenDeltaB = 0;
        int256 afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallCappedDeltaB = 100;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            beforeOverallDeltaB,
            afterOverallDeltaB,
            beforeInputTokenDeltaB,
            beforeOutputTokenDeltaB,
            afterInputTokenDeltaB,
            afterOutputTokenDeltaB,
            bdvConverted,
            overallCappedDeltaB,
            inputToken,
            outputToken
        );
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyDownwardsToZero() public {
        int256 beforeOverallDeltaB = 100;
        int256 afterOverallDeltaB = 0;
        int256 beforeInputTokenDeltaB = -100;
        int256 beforeOutputTokenDeltaB = 0;
        int256 afterInputTokenDeltaB = 0;
        int256 afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallCappedDeltaB = 100;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            beforeOverallDeltaB,
            afterOverallDeltaB,
            beforeInputTokenDeltaB,
            beforeOutputTokenDeltaB,
            afterInputTokenDeltaB,
            afterOutputTokenDeltaB,
            bdvConverted,
            overallCappedDeltaB,
            inputToken,
            outputToken
        );
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyDownwardsNonZero() public {
        int256 beforeOverallDeltaB = 200;
        int256 afterOverallDeltaB = 100;
        int256 beforeInputTokenDeltaB = -100;
        int256 beforeOutputTokenDeltaB = 0;
        int256 afterInputTokenDeltaB = 0;
        int256 afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallCappedDeltaB = 100;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            beforeOverallDeltaB,
            afterOverallDeltaB,
            beforeInputTokenDeltaB,
            beforeOutputTokenDeltaB,
            afterInputTokenDeltaB,
            afterOutputTokenDeltaB,
            bdvConverted,
            overallCappedDeltaB,
            inputToken,
            outputToken
        );
        assertEq(penalty, 0);
    }

    function testCalculateStalkPenaltyCrossPegUpward() public {
        int256 beforeOverallDeltaB = -50;
        int256 afterOverallDeltaB = 50;
        int256 beforeInputTokenDeltaB = -100;
        int256 beforeOutputTokenDeltaB = 0;
        int256 afterInputTokenDeltaB = 0;
        int256 afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallCappedDeltaB = 50;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            beforeOverallDeltaB,
            afterOverallDeltaB,
            beforeInputTokenDeltaB,
            beforeOutputTokenDeltaB,
            afterInputTokenDeltaB,
            afterOutputTokenDeltaB,
            bdvConverted,
            overallCappedDeltaB,
            inputToken,
            outputToken
        );
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyCrossPegDownward() public {
        int256 beforeOverallDeltaB = 50;
        int256 afterOverallDeltaB = -50;
        int256 beforeInputTokenDeltaB = -100;
        int256 beforeOutputTokenDeltaB = 0;
        int256 afterInputTokenDeltaB = 0;
        int256 afterOutputTokenDeltaB = 0;
        uint256 bdvConverted = 100;
        uint256 overallCappedDeltaB = 50;
        address inputToken = C.BEAN_ETH_WELL;
        address outputToken = C.BEAN;

        uint256 penalty = LibConvert.calculateStalkPenalty(
            beforeOverallDeltaB,
            afterOverallDeltaB,
            beforeInputTokenDeltaB,
            beforeOutputTokenDeltaB,
            afterInputTokenDeltaB,
            afterOutputTokenDeltaB,
            bdvConverted,
            overallCappedDeltaB,
            inputToken,
            outputToken
        );
        assertEq(penalty, 50);
    }*/

/*
    function testCalculateStalkPenaltyNoCappedDeltaB() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 0;
        uint256 bdvRemoved = 100;
        uint256 cappedDeltaB = 0;
        uint256 penalty = LibConvert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvRemoved, cappedDeltaB);
        assertEq(penalty, 100);
    }

    function testCalculateStalkPenaltyNoCappedDeltaBNotZero() public {
        int256 beforeDeltaB = 101;
        int256 afterDeltaB = 1;
        uint256 bdvRemoved = 100;
        uint256 cappedDeltaB = 0;
        uint256 penalty = LibConvert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvRemoved, cappedDeltaB);
        assertEq(penalty, 100);
    }

    function testCalculateStalkPenaltyNoCappedDeltaBNotZeroHalf() public {
        int256 beforeDeltaB = 101;
        int256 afterDeltaB = 1;
        uint256 bdvRemoved = 100;
        uint256 cappedDeltaB = 50;
        uint256 penalty = LibConvert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvRemoved, cappedDeltaB);
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyNoCappedDeltaBToZeroHalf() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 0;
        uint256 bdvRemoved = 100;
        uint256 cappedDeltaB = 50;
        uint256 penalty = LibConvert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvRemoved, cappedDeltaB);
        assertEq(penalty, 50);
    }

    function testCalculateStalkPenaltyLPtoLPSmallSlippage() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 101;
        uint256 bdvRemoved = 100;
        uint256 cappedDeltaB = 100;
        uint256 penalty = LibConvert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvRemoved, cappedDeltaB);
        assertEq(penalty, 1);
    }

    function testCalculateStalkPenaltyLPtoLPLargeSlippageNoCapped() public {
        int256 beforeDeltaB = 100;
        int256 afterDeltaB = 151;
        uint256 bdvRemoved = 100;
        uint256 cappedDeltaB = 0;
        uint256 penalty = LibConvert.calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvRemoved, cappedDeltaB);
        assertEq(penalty, 51);
    }*/

    function testCalcStalkPenaltyUpToPeg() public {
        (LibConvert.DeltaBStorage memory dbs, address inputToken, address outputToken, uint256 bdvConverted, uint256 overallConvertCapacity) = setupTowardsPegDeltaBStorageNegative();

        uint256 stalkPenaltyBdv = LibConvert.calculateStalkPenalty(dbs, bdvConverted, overallConvertCapacity, inputToken, outputToken);
        assertEq(stalkPenaltyBdv, 0);
    }

    function testCalcStalkPenaltyDownToPeg() public {
        (LibConvert.DeltaBStorage memory dbs, address inputToken, address outputToken, uint256 bdvConverted, uint256 overallConvertCapacity) = setupTowardsPegDeltaBStorageNegative();

        dbs.beforeInputTokenDeltaB = 100;
        dbs.beforeOutputTokenDeltaB = 100;

        uint256 stalkPenaltyBdv = LibConvert.calculateStalkPenalty(dbs, bdvConverted, overallConvertCapacity, inputToken, outputToken);
        assertEq(stalkPenaltyBdv, 0);
    }

    function testCalcStalkPenaltyNoOverallCap() public {
        (LibConvert.DeltaBStorage memory dbs, address inputToken, address outputToken, uint256 bdvConverted, uint256 overallConvertCapacity) = setupTowardsPegDeltaBStorageNegative();

        overallConvertCapacity = 0;
        dbs.beforeOverallDeltaB = -100;

        uint256 stalkPenaltyBdv = LibConvert.calculateStalkPenalty(dbs, bdvConverted, overallConvertCapacity, inputToken, outputToken);
        assertEq(stalkPenaltyBdv, 100);
    }

    function testCalcStalkPenaltyNoInputTokenCap() public {
        (LibConvert.DeltaBStorage memory dbs, address inputToken, address outputToken, uint256 bdvConverted, uint256 overallConvertCapacity) = setupTowardsPegDeltaBStorageNegative();

        dbs.beforeOverallDeltaB = -100;

        uint256 stalkPenaltyBdv = LibConvert.calculateStalkPenalty(dbs, bdvConverted, overallConvertCapacity, inputToken, outputToken);
        assertEq(stalkPenaltyBdv, 100);
    }

    function testCalcStalkPenaltyNoOutputTokenCap() public {
        (LibConvert.DeltaBStorage memory dbs, address inputToken, address outputToken, uint256 bdvConverted, uint256 overallConvertCapacity) = setupTowardsPegDeltaBStorageNegative();

        inputToken = C.BEAN;
        outputToken = C.BEAN_ETH_WELL;
        dbs.beforeOverallDeltaB = -100;

        uint256 stalkPenaltyBdv = LibConvert.calculateStalkPenalty(dbs, bdvConverted, overallConvertCapacity, inputToken, outputToken);
        assertEq(stalkPenaltyBdv, 100);
    }

    function setupTowardsPegDeltaBStorageNegative() public pure returns (
        LibConvert.DeltaBStorage memory dbs,
        address inputToken,
        address outputToken,
        uint256 bdvConverted,
        uint256 overallConvertCapacity
    ) {
        dbs.beforeInputTokenDeltaB = -100;
        dbs.afterInputTokenDeltaB = 0;
        dbs.beforeOutputTokenDeltaB = -100;
        dbs.afterOutputTokenDeltaB = 0;
        dbs.beforeOverallDeltaB = 0;
        dbs.afterOverallDeltaB = 0;

        inputToken = C.BEAN_ETH_WELL;
        outputToken = C.BEAN;

        bdvConverted = 100;
        overallConvertCapacity = 100;
    }


    ////// SILO TEST HELPERS //////

    function mineBlockAndUpdatePumps() public {
        // mine a block so convert power is updated
        vm.roll(block.number + 1);
        updateMockPumpUsingWellReserves(C.BEAN_ETH_WELL);
        updateMockPumpUsingWellReserves(C.BEAN_WSTETH_WELL);
    }

    function updateMockPumpUsingWellReserves(address well) public {
        Call[] memory pumps = IWell(well).pumps();
        for (uint i = 0; i < pumps.length; i++) {
            address pump = pumps[i].target;
            // pass to the pump the reserves that we actually have in the well
            uint[] memory reserves = IWell(well).getReserves();
            MockPump(pump).update(well, reserves, new bytes(0));

            console.log('updated reserves for pump: ', pump);
            console.log('well: ', well);
            console.log('reserves: ');
            for (uint j = 0; j < reserves.length; j++) {
                console.log('reserves[j]: ', reserves[j]);
            }
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

    function depositLPAndPassGermination(uint256 amount) public returns (int96 stem, uint256 lpAmountOut) {
        // mint beans to user 1
        bean.mint(users[1], amount);
        // user 1 deposits bean into bean:eth well, first approve
        vm.prank(users[1]);
        bean.approve(C.BEAN_ETH_WELL, type(uint256).max);

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = amount;
        tokenAmountsIn[1] = 0;

        vm.prank(users[1]);
        lpAmountOut = IWell(C.BEAN_ETH_WELL).addLiquidity(tokenAmountsIn, 0, users[1], type(uint256).max);

        // approve spending well token to beanstalk
        vm.prank(users[1]);
        MockToken(C.BEAN_ETH_WELL).approve(BEANSTALK, type(uint256).max);

        vm.prank(users[1]);
        ( , , stem) = silo.deposit(C.BEAN_ETH_WELL, lpAmountOut, LibTransfer.From.EXTERNAL);

        passGermination();
    }

    function beanToLPDoConvert(uint256 amount, int96 stem, address user) public 
        returns (int96 outputStem, uint256 outputAmount) {
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
        (outputStem, outputAmount, , , ) = convert.pipelineConvert(
            C.BEAN, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN_ETH_WELL, // token out
            farmCalls // farmData
        );
    }

    function lpToBeanDoConvert(uint256 lpAmountOut, int96 stem, address user) public
        returns (int96 outputStem, uint256 outputAmount) {
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
        (outputStem, outputAmount, , , ) = convert.pipelineConvert(
            C.BEAN_ETH_WELL, // input token
            stems,  // stems
            amounts,  // amount
            C.BEAN, // token out
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

    function removeEthFromWell(address user, uint256 amount) public returns (uint256 lpAmountOut) {
        MockToken(C.WETH).mint(user, amount);

        vm.prank(user);
        MockToken(C.WETH).approve(C.BEAN_ETH_WELL, amount);

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = 0;
        tokenAmountsIn[1] = amount;

        vm.prank(user);
        // lpAmountOut = IWell(C.BEAN_ETH_WELL).addLiquidity(tokenAmountsIn, 0, user, type(uint256).max);
        lpAmountOut = IWell(C.BEAN_ETH_WELL).removeLiquidityOneToken(amount, IERC20(C.WETH), 0, user, type(uint256).max);

        console.log('lpAmountOut: ', lpAmountOut);

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
        return createBeanToLPFarmCalls(amountOfBean, new AdvancedPipeCall[](0));
    }

    function createBeanToLPFarmCalls(
        uint256 amountOfBean,
        AdvancedPipeCall[] memory extraPipeCalls
    ) public view returns (AdvancedFarmCall[] memory output) {
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
        AdvancedPipeCall[] memory advancedPipeCalls = new AdvancedPipeCall[](2+extraPipeCalls.length);
        
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

        // append any extra pipe calls
        for (uint i; i < extraPipeCalls.length; i++) {
            advancedPipeCalls[2+i] = extraPipeCalls[i];
        }


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

    function createAdvancedFarmCallsFromAdvancedPipeCalls(AdvancedPipeCall[] memory advancedPipeCalls) public view returns (AdvancedFarmCall[] memory) {
        AdvancedFarmCall[] memory advancedFarmCalls = new AdvancedFarmCall[](1);
        bytes memory advancedPipeCalldata = 
            abi.encodeWithSelector(
                depot.advancedPipe.selector,
                advancedPipeCalls,
                0
            );

        advancedFarmCalls[0] = AdvancedFarmCall(advancedPipeCalldata, new bytes(0));
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

    function createLPToLPFarmCalls(
        uint256 amountOfLP
    ) public returns (AdvancedFarmCall[] memory output) {
        
        console.log('createLPToBean amountOfLP: ', amountOfLP);

        // setup approve max call
        bytes memory approveEncoded = abi.encodeWithSelector(
            IERC20.approve.selector,
            C.BEAN_WSTETH_WELL,
            MAX_UINT256
        );

        // encode remove liqudity.
        bytes memory removeLiquidityEncoded = abi.encodeWithSelector(
            IWell.removeLiquidityOneToken.selector,
            amountOfLP, // lpAmountIn
            C.BEAN, // tokenOut
            0, // min out
            C.PIPELINE, // recipient
            type(uint256).max // deadline
        );

        uint256[] memory emptyAmountsIn = new uint256[](2); 
        emptyAmountsIn[0] = 0;
        emptyAmountsIn[1] = 0; // need to paste in here


        // encode add liquidity
        bytes memory addLiquidityEncoded = abi.encodeWithSelector(
            IWell.addLiquidity.selector,
            emptyAmountsIn, // to be pasted in
            0, // min out
            C.PIPELINE, // recipient
            type(uint256).max // deadline
        );

        // Fabricate advancePipes: 
        AdvancedPipeCall[] memory advancedPipeCalls = new AdvancedPipeCall[](3);
        
        // Action 0: approve the Bean-Eth well to spend pipeline's bean.
        advancedPipeCalls[0] = AdvancedPipeCall(
            C.BEAN, // target
            approveEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // Action 1: remove beans from well. 
        advancedPipeCalls[1] = AdvancedPipeCall(
            C.BEAN_ETH_WELL, // target
            removeLiquidityEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // returnDataItemIndex, copyIndex, pasteIndex
        bytes memory clipboard = abi.encodePacked(
            bytes2(0x0100), // clipboard type 1
            uint80(1), // from result of call at index 1
            uint80(32), // take the first param
            uint80(196) // paste into the 6th 32 bytes of the clipboard
        );

        // Action 2: add beans to wsteth:bean well. 
        advancedPipeCalls[2] = AdvancedPipeCall(
            C.BEAN_WSTETH_WELL, // target
            addLiquidityEncoded, // calldata
            clipboard
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