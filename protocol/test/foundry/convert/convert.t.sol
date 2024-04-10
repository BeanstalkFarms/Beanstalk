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

    // Interfaces.
    IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);
    MockConvertFacet convert = MockConvertFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
    
    // test accounts
    address[] farmers;
  
    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // init user.
        farmers.push(users[1]);
        vm.prank(farmers[0]);
        C.bean().approve(BEANSTALK, type(uint256).max);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            C.BEAN_ETH_WELL,
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
        address well = C.BEAN_ETH_WELL;
        beanAmount = bound(beanAmount, 0, 9000e6);
        
        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0);
        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0);
        
        uint256 snapshot = vm.snapshot();
        // decrease bean reserves
        setReserves(
            well,
            IERC20(C.BEAN).balanceOf(well) - beanAmount,
            IERC20(C.WETH).balanceOf(well)
        );

        assertEq(bs.getMaxAmountIn(C.BEAN, well), beanAmount);
        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0);

        vm.revertTo(snapshot);

        // increase bean reserves
        setReserves(
            well,
            IERC20(C.BEAN).balanceOf(well) + beanAmount,
            IERC20(C.WETH).balanceOf(well)
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
        address well = C.BEAN_ETH_WELL;
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(
            well,
            IERC20(C.BEAN).balanceOf(well) - beanAmount,
            IERC20(C.WETH).balanceOf(well)
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            C.BEAN_ETH_WELL, // well
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

    function test_convert

    /**
     * @notice Convert should fail if user does not have the required deposits.
     */
    function test_bean_Well_invalidDeposit(uint256 beanAmount) public {
        beanToWellSetup();
        address well = C.BEAN_ETH_WELL;
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(
            well,
            IERC20(C.BEAN).balanceOf(well) - beanAmount,
            IERC20(C.WETH).balanceOf(well)
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            C.BEAN_ETH_WELL, // well
            beanAmount, // amountIn
            0 // minOut
        );
        int96[] memory stems = new int96[](1);
        stems[0] = int96(0);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = uint256(beanAmount);
        
        vm.expectRevert("Silo: Crate balance too low.");
        convert.convert(
            convertData,
            stems,
            amounts
        );
    }

    //////////// BEAN -> WELL ////////////

    /**
     * @notice Bean -> Well convert cannot occur below peg.
     */
    function test_convertBeanToWell_belowPeg(uint256 beanAmount) public {
        beanToWellSetup();
        address well = C.BEAN_ETH_WELL;
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(
            well,
            IERC20(C.BEAN).balanceOf(well) + beanAmount,
            IERC20(C.WETH).balanceOf(well)
        );

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            C.BEAN_ETH_WELL, // well
            1, // amountIn
            0 // minOut
        );
        int96[] memory stems = new int96[](1);
        stems[0] = int96(0);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = uint256(1);
        
        vm.expectRevert("Convert: P must be >= 1.");
        vm.prank(farmers[0]);
        convert.convert(
            convertData,
            stems,
            amounts
        );
    }

    /**
     * @notice Bean -> Well convert cannot convert beyond peg.
     */
    function test_convertBeanToWell_beyondPeg() public {
        
        beanToWellSetup();

    }

    /**
     * @notice general convert test.
     */
    function test_convertBeanToWell() public {
        beanToWellSetup();

    }

    /**
     * @notice general convert test. Uses multiple deposits.
     */
    function test_convertsBeanToWell() public {
        beanToWellSetup();

    }

    function beanToWellSetup() public {
        // Create 2 deposits, each at 1000 Beans to farmer[0].
        C.bean().mint(farmers[0], 2000e6);
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, 1000e6, 0);
        season.siloSunrise(0);
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, 1000e6, 0);

        // Germinating deposits cannot convert (see {LibGerminate}). 
        // End germination process.
        season.siloSunrise(0);
        season.siloSunrise(0);
    }

    //////////// WELL -> BEAN ////////////

    /**
     * @notice Well -> Bean convert cannot occur above peg.
     */
    function test_convertWellToBean_abovePeg() public {

    }

    /**
     * @notice Well -> Bean convert cannot occur beyond peg.
     */
    function test_convertWellToBean_beyondPeg() public {

    }

    /**
     * @notice Well -> Bean convert must use a whitelisted well.
     */
    function test_convertWellToBean_invalidWell() public {

    }

    /**
     * @notice general convert test.
     */
    function test_convertWellToBean() public {

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
    ) internal returns (bytes memory) {
        if(kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            // lamda_lamda encoding
            return abi.encode(kind, amountIn, token);
        } else {
            // default encoding
            return abi.encode(kind, amountIn, minAmountOut, token); 
        }
    }
}