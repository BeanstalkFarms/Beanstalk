// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IWell, IERC20} from "../utils/TestHelper.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {C} from "contracts/C.sol";
import {console} from "forge-std/console.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

/**
 * @title ConvertTest
 * @author Brean
 * @notice Tests the `convert` functionality.
 * @dev `convert` is the ability for users to switch a deposits token 
 * from one whitelisted silo token to another, 
 * given valid conditions. Generally, the ability to convert is based on
 * peg maintainence. See {LibConvert} for more infomation on specific convert types.
 */
contract ConvertTest is TestHelper {

    event Convert(address indexed account, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount);

    // Interfaces.
    IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);
    MockConvertFacet convert = MockConvertFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

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
    }

    //////////// BEAN <> WELL ////////////

    /**
     * @notice validates that `getMaxAmountIn` gives the proper output.
     */
    function test_bean_Well_getters(uint256 beanAmount) public {
        beanToWellSetup();
        beanAmount = bound(beanAmount, 0, 9000e6);
        
        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0);
        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0);
        
        uint256 snapshot = vm.snapshot();
        // decrease bean reserves
        setReserves(
            well,
            bean.balanceOf(well) - beanAmount,
            weth.balanceOf(well)
        );

        assertEq(bs.getMaxAmountIn(C.BEAN, well), beanAmount);
        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0);

        vm.revertTo(snapshot);

        // increase bean reserves
        setReserves(
            well,
            bean.balanceOf(well) + beanAmount,
            weth.balanceOf(well)
        );
        
        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0);
        // convert lp amount to beans:
        uint256 lpAmountOut = bs.getMaxAmountIn(well, C.BEAN);
        uint256 beansOut = IWell(well).getRemoveLiquidityOneTokenOut(lpAmountOut, C.bean());
        assertEq(beansOut, beanAmount);
    }

    /**
     * @notice Convert should fail if deposit amounts != convertData.
     */
    function test_bean_Well_fewTokensRemoved(uint256 beanAmount) public {
        beanToWellSetup();
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(
            well,
            bean.balanceOf(well) - beanAmount,
            weth.balanceOf(well)
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            beanAmount, // amountIn
            0 // minOut
        );
        int96[] memory stems = new int96[](1);
        stems[0] = int96(0);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = uint256(1);
        
        vm.expectRevert("Convert: Not enough tokens removed.");
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            stems,
            amounts
        );
    }

    /**
     * @notice Convert should fail if user does not have the required deposits.
     */
    function test_bean_Well_invalidDeposit(uint256 beanAmount) public {
        beanToWellSetup();
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(
            well,
            bean.balanceOf(well) - beanAmount,
            weth.balanceOf(well)
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            beanAmount, // amountIn
            0 // minOut
        );
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = uint256(beanAmount);
        
        vm.expectRevert("Silo: Crate balance too low.");
        convert.convert(
            convertData,
            new int96[](1),
            amounts
        );
    }

    //////////// BEAN -> WELL ////////////

    /**
     * @notice Bean -> Well convert cannot occur below peg.
     */
    function test_convertBeanToWell_belowPeg(uint256 beanAmount) public {
        beanToWellSetup();
        
        beanAmount = bound(beanAmount, 1, 1000e6);
        // increase the amount of beans in the pool (below peg).
        setReserves(well, bean.balanceOf(well) + beanAmount, weth.balanceOf(well));

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            1, // amountIn
            0 // minOut
        );
        
        vm.expectRevert("Convert: P must be >= 1.");
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            new int96[](1),
            new uint256[](1)
        );
    }

    /**
     * @notice Bean -> Well convert cannot convert beyond peg.
     * @dev if minOut is not contrained, the convert will succeed,
     * but only to the amount of beans that can be converted to the peg.
     */
    function test_convertBeanToWell_beyondPeg(
        uint256 beansRemovedFromWell
    ) public {
        beanToWellSetup();

        uint256 beanWellAmount = bound(beansRemovedFromWell, C.WELL_MINIMUM_BEAN_BALANCE, bean.balanceOf(well) - 1);
        
        setReserves(well, beanWellAmount, weth.balanceOf(well));

        uint256 expectedBeansConverted = 10000e6 - beanWellAmount; 
        uint256 expectedAmtOut = bs.getAmountOut(
            C.BEAN, 
            well, 
            expectedBeansConverted
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            type(uint256).max, // amountIn
            0 // minOut
        );

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = type(uint256).max;

        vm.expectEmit();
        emit Convert(farmers[0], C.BEAN, well, expectedBeansConverted, expectedAmtOut);
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            new int96[](1),
            amounts
        );

        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0);
    }

    /**
     * @notice general convert test.
     */
    function test_convertBeanToWell(
        uint256 deltaB,
        uint256 beansConverted
    ) public {
        beanToWellSetup();
        
        deltaB = bound(deltaB, 1, bean.balanceOf(well) - C.WELL_MINIMUM_BEAN_BALANCE);
        setReserves(
            well,
            bean.balanceOf(well) - deltaB,
            weth.balanceOf(well)
        );

        uint256 beansConverted = bound(beansConverted, 1, deltaB);
        
        uint256 expectedAmtOut = bs.getAmountOut(
            C.BEAN, 
            well, 
            beansConverted
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            beansConverted, // amountIn
            0 // minOut
        );

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = beansConverted;

        vm.expectEmit();
        emit Convert(farmers[0], C.BEAN, well, beansConverted, expectedAmtOut);
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            new int96[](1),
            amounts
        );

        // verify deltaB. 
        assertEq(bs.getMaxAmountIn(C.BEAN, well), deltaB - beansConverted);
    }

    /**
     * @notice general convert test. Uses multiple deposits.
     */
    function test_convertsBeanToWell(
        uint256 deltaB,
        uint256 beansConverted
    ) public {
        beanToWellSetup();
        
        deltaB = bound(deltaB, 2, bean.balanceOf(well) - C.WELL_MINIMUM_BEAN_BALANCE);
        setReserves(
            well,
            bean.balanceOf(well) - deltaB,
            weth.balanceOf(well)
        );

        beansConverted = bound(beansConverted, 2, deltaB);
        
        uint256 expectedAmtOut = bs.getAmountOut(
            C.BEAN, 
            well,
            beansConverted
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            beansConverted, // amountIn
            0 // minOut
        );

        int96[] memory stems = new int96[](2);
        stems[0] = int96(0);
        stems[1] = int96(2e6);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = beansConverted / 2;
        amounts[1] = beansConverted - amounts[0];

        vm.expectEmit();
        emit Convert(farmers[0], C.BEAN, well, beansConverted, expectedAmtOut);
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            stems,
            amounts
        );

        // verify deltaB. 
        assertEq(bs.getMaxAmountIn(C.BEAN, well), deltaB - beansConverted);
    }

    function beanToWellSetup() public {
        // Create 2 deposits, each at 10000 Beans to farmer[0].
        C.bean().mint(farmers[0], 20000e6);
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, 10000e6, 0);
        season.siloSunrise(0);
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, 10000e6, 0);

        // Germinating deposits cannot convert (see {LibGerminate}). 
        // End germination process.
        season.siloSunrise(0);
        season.siloSunrise(0);
    }

    //////////// WELL -> BEAN ////////////

    /**
     * @notice Well -> Bean convert cannot occur above peg.
     */
    function test_convertWellToBean_abovePeg(uint256 beanAmount) public {
        wellToBeanSetup();

        beanAmount = bound(beanAmount, 1, 1000e6);
        // decrease the amount of beans in the pool (above peg).
        setReserves(well, bean.balanceOf(well) - beanAmount, weth.balanceOf(well));

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.WELL_LP_TO_BEANS,
            well, // well
            1, // amountIn
            0 // minOut
        );
        
        vm.expectRevert("Convert: P must be < 1.");
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            new int96[](1),
            new uint256[](1)
        );
        
    }

    /**
     * @notice Well -> Bean convert cannot occur beyond peg.
     */
    function test_convertWellToBean_beyondPeg(
        uint256 beansAddedToWell
    ) public {
        wellToBeanSetup();
        
        beansAddedToWell = bound(beansAddedToWell, 1, 10000e6);
        uint256 beanWellAmount = bean.balanceOf(well) + beansAddedToWell;
        
        setReserves(well, beanWellAmount, weth.balanceOf(well));

        uint256 maxLPin = bs.getMaxAmountIn(well, C.BEAN);

        // create encoding for a well -> bean convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.WELL_LP_TO_BEANS,
            well, // well
            type(uint256).max, // amountIn
            0 // minOut
        );

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = type(uint256).max;

        vm.expectEmit();
        emit Convert(farmers[0], well, C.BEAN, maxLPin, beansAddedToWell);
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            new int96[](1),
            amounts
        );

        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0);
    }

    /**
     * @notice Well -> Bean convert must use a whitelisted well.
     */
    function test_convertWellToBean_invalidWell(uint256 i) public {
        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.WELL_LP_TO_BEANS,
            address(bytes20(keccak256(abi.encode(i)))), // invalid well
            0, // amountIn
            0 // minOut
        );

        vm.expectRevert("Convert: Invalid Well");
        convert.convert(
            convertData,
            new int96[](1),
            new uint256[](1)
        );
    }

    /**
     * @notice general convert test.
     */
    function test_convertWellToBeanGeneral(uint256 deltaB, uint256 lpConverted) public {
        // minLP as anything lower than this would result in 0 beans removed.
        uint256[] memory amountIn = new uint256[](2);
        amountIn[0] = 1;
        uint256 minLp = IWell(well).getAddLiquidityOut(amountIn); 
        uint256 lpMinted = wellToBeanSetup();
        
        deltaB = bound(deltaB, 1e6, 1_000_000_000_000_000e6);
        setReserves(well, bean.balanceOf(well) + deltaB, weth.balanceOf(well));
        uint256 initalWellBeanBalance = bean.balanceOf(well);
        uint256 initalLPbalance = MockToken(well).totalSupply();
        uint256 initalBeanBalance = bean.balanceOf(BEANSTALK);

        uint256 maxLpIn = bs.getMaxAmountIn(well, C.BEAN);
        lpConverted = bound(lpConverted, minLp, lpMinted / 2);

        // if the maximum LP that can be used is less than 
        // the amount that the user wants to convert,
        // cap the amount to the maximum LP that can be used.
        if(lpConverted > maxLpIn) lpConverted = maxLpIn;
        
        uint256 expectedAmtOut = bs.getAmountOut(well, C.BEAN, lpConverted);

        // create encoding for a well -> bean convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.WELL_LP_TO_BEANS,
            well, // well
            lpConverted, // amountIn
            0 // minOut
        );

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = lpConverted;

        vm.expectEmit();
        emit Convert(farmers[0], well, C.BEAN, lpConverted, expectedAmtOut);
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            new int96[](1),
            amounts
        );

        // verify deltaB. 
        console.log("new max amount in:", bs.getMaxAmountIn(well, C.BEAN));
        assertApproxEqRel(bs.getMaxAmountIn(well, C.BEAN), maxLpIn - lpConverted, 0.001e18); // .1% precision
        assertEq(bean.balanceOf(well), initalWellBeanBalance - expectedAmtOut);
        assertEq(MockToken(well).totalSupply(), initalLPbalance - lpConverted);
        assertEq(bean.balanceOf(BEANSTALK), initalBeanBalance + expectedAmtOut);
    }

    function wellToBeanSetup() public returns (uint256 lpMinted) {
        // Create 2 LP deposits worth 200_000 BDV. 
        // note: LP is minted with an price of 1000 beans. 
        lpMinted = mintBeanLPtoUser(
            well,
            farmers[0],
            100000e6,
            1000e6
        );
        vm.startPrank(farmers[0]);
        MockToken(well).approve(BEANSTALK, type(uint256).max);  
        bs.deposit(well, lpMinted/2, 0);
        season.siloSunrise(0);
        bs.deposit(well, lpMinted/2, 0);

        // Germinating deposits cannot convert (see {LibGerminate}). 
        // End germination process.
        season.siloSunrise(0);
        season.siloSunrise(0);
        vm.stopPrank();
    }

    /**
     * @notice issues a bean-tkn LP to user. the amount of LP issued is based on some price ratio.
     */
    function mintBeanLPtoUser(
        address well,
        address account, 
        uint256 beanAmount,
        uint256 priceRatio // ratio of TKN/BEAN (6 decimal precision)
    ) internal returns(uint256 amountOut) {
        IERC20[] memory tokens = IWell(well).tokens();
        address nonBeanToken = address(tokens[0]) == C.BEAN ? address(tokens[1]) : address(tokens[0]);
        bean.mint(well, beanAmount);
        MockToken(nonBeanToken).mint(well, beanAmount * 1e18 / priceRatio);
        amountOut = IWell(well).sync(account, 0);
    }

    //////////// LAMBDA/LAMBDA ////////////

    /**
     * @notice lamda_lamda convert increases BDV.
     */
    function test_lamdaLamda_increaseBDV() public {

    }

    /**
     * @notice lamda_lamda convert does not decrease BDV.
     */
    function test_lamdaLamda_decreaseBDV() public {

    }

    /**
     * @notice lamda_lamda convert combines deposits.
     */
    function test_lamdaLamda_combineDeposits() public {

    }

    //////////// UNRIPE_BEAN TO UNRIPE_LP ////////////

    //////////// UNRIPE_LP TO UNRIPE_BEAN ////////////


    //////////////// CONVERT HELPERS /////////////////

    function convertEncoder(
        LibConvertData.ConvertKind kind,
        address token,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal pure returns (bytes memory) {
        if(kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            // lamda_lamda encoding
            return abi.encode(kind, amountIn, token);
        } else {
            // default encoding
            return abi.encode(kind, amountIn, minAmountOut, token); 
        }
    }
}