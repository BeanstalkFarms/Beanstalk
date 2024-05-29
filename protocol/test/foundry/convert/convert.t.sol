// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IMockFBeanstalk, C} from "test/foundry/utils/TestHelper.sol";
import {IWell, IERC20} from "contracts/interfaces/basin/IWell.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";

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
    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

    // Interfaces.
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
        maxApproveBeanstalk(farmers);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            well,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        addLiquidityToWell(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 WETH of wstETH
        );
    }

    //////////// BEAN <> WELL ////////////

    /**
     * @notice validates that `getMaxAmountIn` gives the proper output.
     */
    function test_bean_Well_getters(uint256 beanAmount) public {
        multipleBeanDepositSetup();
        beanAmount = bound(beanAmount, 0, 9000e6);

        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0, "BEAN -> WELL maxAmountIn should be 0");
        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0, "WELL -> BEAN maxAmountIn should be 0");

        uint256 snapshot = vm.snapshot();
        // decrease bean reserves
        setReserves(well, bean.balanceOf(well) - beanAmount, weth.balanceOf(well));

        assertEq(
            bs.getMaxAmountIn(C.BEAN, well),
            beanAmount,
            "BEAN -> WELL maxAmountIn should be beanAmount"
        );
        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0, "WELL -> BEAN maxAmountIn should be 0");

        vm.revertTo(snapshot);

        // increase bean reserves
        setReserves(well, bean.balanceOf(well) + beanAmount, weth.balanceOf(well));

        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0, "BEAN -> WELL maxAmountIn should be 0");
        // convert lp amount to beans:
        uint256 lpAmountOut = bs.getMaxAmountIn(well, C.BEAN);
        uint256 beansOut = IWell(well).getRemoveLiquidityOneTokenOut(lpAmountOut, C.bean());
        assertEq(beansOut, beanAmount, "beansOut should equal beanAmount");
    }

    /**
     * @notice Convert should fail if deposit amounts != convertData.
     */
    function test_bean_Well_fewTokensRemoved(uint256 beanAmount) public {
        multipleBeanDepositSetup();
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(well, bean.balanceOf(well) - beanAmount, weth.balanceOf(well));

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
        convert.convert(convertData, stems, amounts);
    }

    /**
     * @notice Convert should fail if user does not have the required deposits.
     */
    function test_bean_Well_invalidDeposit(uint256 beanAmount) public {
        multipleBeanDepositSetup();
        beanAmount = bound(beanAmount, 2, 1000e6);
        setReserves(well, bean.balanceOf(well) - beanAmount, weth.balanceOf(well));

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
        convert.convert(convertData, new int96[](1), amounts);
    }

    //////////// BEAN -> WELL ////////////

    /**
     * @notice Bean -> Well convert cannot occur below peg.
     */
    function test_convertBeanToWell_belowPeg(uint256 beanAmount) public {
        multipleBeanDepositSetup();

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
        convert.convert(convertData, new int96[](1), new uint256[](1));
    }

    /**
     * @notice Bean -> Well convert cannot convert beyond peg.
     * @dev if minOut is not contrained, the convert will succeed,
     * but only to the amount of beans that can be converted to the peg.
     */
    function test_convertBeanToWell_beyondPeg(uint256 beansRemovedFromWell) public {
        multipleBeanDepositSetup();

        uint256 beanWellAmount = bound(
            beansRemovedFromWell,
            C.WELL_MINIMUM_BEAN_BALANCE,
            bean.balanceOf(well) - 1
        );

        setReserves(well, beanWellAmount, weth.balanceOf(well));

        uint256 expectedBeansConverted = 10000e6 - beanWellAmount;
        uint256 expectedAmtOut = bs.getAmountOut(C.BEAN, well, expectedBeansConverted);

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
        convert.convert(convertData, new int96[](1), amounts);

        assertEq(bs.getMaxAmountIn(C.BEAN, well), 0, "BEAN -> WELL maxAmountIn should be 0");
    }

    /**
     * @notice general convert test.
     */
    function test_convertBeanToWellGeneral(uint256 deltaB, uint256 beansConverted) public {
        multipleBeanDepositSetup();

        deltaB = bound(deltaB, 100, 7000e6);
        setDeltaBforWell(int256(deltaB), well, C.WETH);

        beansConverted = bound(beansConverted, 100, deltaB);

        uint256 expectedAmtOut = bs.getAmountOut(C.BEAN, well, beansConverted);

        // create encoding for a bean -> well convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
            well, // well
            beansConverted, // amountIn
            0 // minOut
        );

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = beansConverted;

        // vm.expectEmit();
        emit Convert(farmers[0], C.BEAN, well, beansConverted, expectedAmtOut);
        vm.prank(farmers[0]);
        convert.convert(convertData, new int96[](1), amounts);

        int256 newDeltaB = LibDeltaB.currentDeltaB(well);

        // verify deltaB.
        // assertEq(bs.getMaxAmountIn(C.BEAN, well), deltaB - beansConverted, 'BEAN -> WELL maxAmountIn should be deltaB - beansConverted');
    }

    /**
     * @notice general convert test. Uses multiple deposits.
     */
    function test_convertsBeanToWellGeneral(uint256 deltaB, uint256 beansConverted) public {
        multipleBeanDepositSetup();

        deltaB = bound(deltaB, 2, bean.balanceOf(well) - C.WELL_MINIMUM_BEAN_BALANCE);
        setReserves(well, bean.balanceOf(well) - deltaB, weth.balanceOf(well));

        beansConverted = bound(beansConverted, 2, deltaB);

        uint256 expectedAmtOut = bs.getAmountOut(C.BEAN, well, beansConverted);

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
        convert.convert(convertData, stems, amounts);

        // verify deltaB.
        assertEq(
            bs.getMaxAmountIn(C.BEAN, well),
            deltaB - beansConverted,
            "BEAN -> WELL maxAmountIn should be deltaB - beansConverted"
        );
    }

    function multipleBeanDepositSetup() public {
        // Create 2 deposits, each at 10000 Beans to farmer[0].
        C.bean().mint(farmers[0], 20000e6);
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, 10000e6, 0);
        season.siloSunrise(0);
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, 10000e6, 0);

        // Germinating deposits cannot convert (see {LibGerminate}).
        passGermination();
    }

    //////////// WELL -> BEAN ////////////

    /**
     * @notice Well -> Bean convert cannot occur above peg.
     */
    function test_convertWellToBean_abovePeg(uint256 beanAmount) public {
        multipleWellDepositSetup();

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
        convert.convert(convertData, new int96[](1), new uint256[](1));
    }

    /**
     * @notice Well -> Bean convert cannot occur beyond peg.
     */
    function test_convertWellToBean_beyondPeg(uint256 beansAddedToWell) public {
        multipleWellDepositSetup();

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
        convert.convert(convertData, new int96[](1), amounts);

        assertEq(bs.getMaxAmountIn(well, C.BEAN), 0, "WELL -> BEAN maxAmountIn should be 0");
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
        convert.convert(convertData, new int96[](1), new uint256[](1));
    }

    /**
     * @notice general convert test.
     */
    function test_convertWellToBeanGeneral(uint256 deltaB, uint256 lpConverted) public {
        uint256 minLp = getMinLPin();
        uint256 lpMinted = multipleWellDepositSetup();

        deltaB = bound(deltaB, 1e6, 1000 ether);
        setReserves(well, bean.balanceOf(well) + deltaB, weth.balanceOf(well));
        uint256 initalWellBeanBalance = bean.balanceOf(well);
        uint256 initalLPbalance = MockToken(well).totalSupply();
        uint256 initalBeanBalance = bean.balanceOf(BEANSTALK);

        uint256 maxLpIn = bs.getMaxAmountIn(well, C.BEAN);
        lpConverted = bound(lpConverted, minLp, lpMinted / 2);

        // if the maximum LP that can be used is less than
        // the amount that the user wants to convert,
        // cap the amount to the maximum LP that can be used.
        if (lpConverted > maxLpIn) lpConverted = maxLpIn;

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
        convert.convert(convertData, new int96[](1), amounts);

        // the new maximum amount out should be the difference between the deltaB and the expected amount out.
        assertEq(
            bs.getAmountOut(well, C.BEAN, bs.getMaxAmountIn(well, C.BEAN)),
            deltaB - expectedAmtOut,
            "amountOut does not equal deltaB - expectedAmtOut"
        );
        assertEq(
            bean.balanceOf(well),
            initalWellBeanBalance - expectedAmtOut,
            "well bean balance does not equal initalWellBeanBalance - expectedAmtOut"
        );
        assertEq(
            MockToken(well).totalSupply(),
            initalLPbalance - lpConverted,
            "well LP balance does not equal initalLPbalance - lpConverted"
        );
        assertEq(
            bean.balanceOf(BEANSTALK),
            initalBeanBalance + expectedAmtOut,
            "bean balance does not equal initalBeanBalance + expectedAmtOut"
        );
    }

    /**
     * @notice general convert test. multiple deposits.
     */
    function test_convertsWellToBeanGeneral(uint256 deltaB, uint256 lpConverted) public {
        uint256 minLp = getMinLPin();
        uint256 lpMinted = multipleWellDepositSetup();

        deltaB = bound(deltaB, 1e6, 1000 ether);
        setReserves(well, bean.balanceOf(well) + deltaB, weth.balanceOf(well));
        uint256 initalWellBeanBalance = bean.balanceOf(well);
        uint256 initalLPbalance = MockToken(well).totalSupply();
        uint256 initalBeanBalance = bean.balanceOf(BEANSTALK);

        uint256 maxLpIn = bs.getMaxAmountIn(well, C.BEAN);
        lpConverted = bound(lpConverted, minLp, lpMinted);

        // if the maximum LP that can be used is less than
        // the amount that the user wants to convert,
        // cap the amount to the maximum LP that can be used.
        if (lpConverted > maxLpIn) lpConverted = maxLpIn;

        uint256 expectedAmtOut = bs.getAmountOut(well, C.BEAN, lpConverted);

        // create encoding for a well -> bean convert.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.WELL_LP_TO_BEANS,
            well, // well
            lpConverted, // amountIn
            0 // minOut
        );

        int96[] memory stems = new int96[](2);
        stems[0] = int96(0);
        stems[1] = int96(4e6); // 1 season of seeds for bean-eth.
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = lpConverted / 2;
        amounts[1] = lpConverted - amounts[0];

        vm.expectEmit();
        emit Convert(farmers[0], well, C.BEAN, lpConverted, expectedAmtOut);
        vm.prank(farmers[0]);
        convert.convert(convertData, stems, amounts);

        // the new maximum amount out should be the difference between the deltaB and the expected amount out.
        assertEq(
            bs.getAmountOut(well, C.BEAN, bs.getMaxAmountIn(well, C.BEAN)),
            deltaB - expectedAmtOut,
            "amountOut does not equal deltaB - expectedAmtOut"
        );
        assertEq(
            bean.balanceOf(well),
            initalWellBeanBalance - expectedAmtOut,
            "well bean balance does not equal initalWellBeanBalance - expectedAmtOut"
        );
        assertEq(
            MockToken(well).totalSupply(),
            initalLPbalance - lpConverted,
            "well LP balance does not equal initalLPbalance - lpConverted"
        );
        assertEq(
            bean.balanceOf(BEANSTALK),
            initalBeanBalance + expectedAmtOut,
            "bean balance does not equal initalBeanBalance + expectedAmtOut"
        );
    }

    function multipleWellDepositSetup() public returns (uint256 lpMinted) {
        // Create 2 LP deposits worth 200_000 BDV.
        // note: LP is minted with an price of 1000 beans.
        lpMinted = mintBeanLPtoUser(farmers[0], 100000e6, 1000e6);
        vm.startPrank(farmers[0]);
        MockToken(well).approve(BEANSTALK, type(uint256).max);

        bs.deposit(well, lpMinted / 2, 0);
        season.siloSunrise(0);
        bs.deposit(well, lpMinted - (lpMinted / 2), 0);

        // Germinating deposits cannot convert (see {LibGerminate}).
        passGermination();
        vm.stopPrank();
    }

    /**
     * @notice issues a bean-tkn LP to user. the amount of LP issued is based on some price ratio.
     */
    function mintBeanLPtoUser(
        address account,
        uint256 beanAmount,
        uint256 priceRatio // ratio of TKN/BEAN (6 decimal precision)
    ) internal returns (uint256 amountOut) {
        IERC20[] memory tokens = IWell(well).tokens();
        address nonBeanToken = address(tokens[0]) == C.BEAN
            ? address(tokens[1])
            : address(tokens[0]);
        bean.mint(well, beanAmount);
        MockToken(nonBeanToken).mint(well, (beanAmount * 1e18) / priceRatio);
        amountOut = IWell(well).sync(account, 0);
    }

    function getMinLPin() internal view returns (uint256) {
        uint256[] memory amountIn = new uint256[](2);
        amountIn[0] = 1;
        return IWell(well).getAddLiquidityOut(amountIn);
    }

    //////////// LAMBDA/LAMBDA ////////////

    /**
     * @notice lamda_lamda convert increases BDV.
     */
    function test_lambdaLambda_increaseBDV(uint256 deltaB) public {
        uint256 lpMinted = multipleWellDepositSetup();

        // create -deltaB to well via swapping, increasing BDV.
        // note: pumps are updated prior to reserves updating,
        // due to its manipulation resistant nature.
        // Thus, A pump needs a block to elapsed to update,
        // or another transaction by the well (if using the mock pump).
        MockToken(bean).mint(well, bound(deltaB, 1, 1000e6));
        IWell(well).shift(IERC20(weth), 0, farmers[0]);
        IWell(well).shift(IERC20(weth), 0, farmers[0]);

        uint256 amtToConvert = lpMinted / 2;

        // create lamda_lamda encoding.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.LAMBDA_LAMBDA,
            well,
            amtToConvert,
            0
        );

        // convert oldest deposit of user.
        int96[] memory stems = new int96[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amtToConvert;

        (uint256 initalAmount, uint256 initialBdv) = bs.getDeposit(farmers[0], well, 0);
        vm.expectEmit();
        emit Convert(farmers[0], well, well, initalAmount, initalAmount);
        vm.prank(farmers[0]);
        (int96 toStem, , , , ) = convert.convert(convertData, stems, amounts);

        (uint256 updatedAmount, uint256 updatedBdv) = bs.getDeposit(farmers[0], well, toStem);
        // the stem of a deposit increased, because the stalkPerBdv of the deposit decreased.
        // stalkPerBdv is calculated by (stemTip - stem).
        assertGt(toStem, int96(0), "new stem should be higher than initial stem");
        assertEq(updatedAmount, initalAmount, "amounts should be equal");
        assertGt(updatedBdv, initialBdv, "new bdv should be higher");
    }

    /**
     * @notice lamda_lamda convert does not decrease BDV.
     */
    function test_lamdaLamda_decreaseBDV(uint256 deltaB) public {
        uint256 lpMinted = multipleWellDepositSetup();

        // create +deltaB to well via swapping, decreasing BDV.
        MockToken(weth).mint(well, bound(deltaB, 1e18, 100e18));
        IWell(well).shift(IERC20(bean), 0, farmers[0]);
        // note: pumps are updated prior to reserves updating,
        // due to its manipulation resistant nature.
        // Thus, A pump needs a block to elapsed to update,
        // or another transaction by the well (if using the mock pump).
        IWell(well).shift(IERC20(bean), 0, farmers[0]);
        uint256 amtToConvert = lpMinted / 2;

        // create lamda_lamda encoding.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.LAMBDA_LAMBDA,
            well,
            amtToConvert,
            0
        );

        // convert oldest deposit of user.
        int96[] memory stems = new int96[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amtToConvert;

        (uint256 initalAmount, uint256 initialBdv) = bs.getDeposit(farmers[0], well, 0);
        vm.expectEmit();
        emit Convert(farmers[0], well, well, initalAmount, initalAmount);
        vm.prank(farmers[0]);
        (int96 toStem, , , , ) = convert.convert(convertData, stems, amounts);

        (uint256 updatedAmount, uint256 updatedBdv) = bs.getDeposit(farmers[0], well, toStem);
        assertEq(toStem, int96(0), "stems should be equal");
        assertEq(updatedAmount, initalAmount, "amounts should be equal");
        assertEq(updatedBdv, initialBdv, "bdv should be equal");
    }

    /**
     * @notice lamda_lamda convert combines deposits.
     */
    function test_lamdaLamda_combineDeposits(uint256 lpCombined) public {
        uint256 lpMinted = multipleWellDepositSetup();
        lpCombined = bound(lpCombined, 2, lpMinted);

        // create lamda_lamda encoding.
        bytes memory convertData = convertEncoder(
            LibConvertData.ConvertKind.LAMBDA_LAMBDA,
            well,
            lpCombined,
            0
        );

        int96[] memory stems = new int96[](2);
        stems[0] = int96(0);
        stems[1] = int96(4e6);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = lpCombined / 2;
        amounts[1] = lpCombined - amounts[0];

        // convert.
        vm.expectEmit();
        emit Convert(farmers[0], well, well, lpCombined, lpCombined);
        vm.prank(farmers[0]);
        convert.convert(convertData, stems, amounts);

        // verify old deposits are gone.
        // see `multipleWellDepositSetup` to understand the deposits.
        (uint256 amount, uint256 bdv) = bs.getDeposit(farmers[0], well, 0);
        assertEq(amount, lpMinted / 2 - amounts[0], "incorrect old deposit amount 0");
        assertApproxEqAbs(
            bdv,
            bs.bdv(well, (lpMinted / 2 - amounts[0])),
            1,
            "incorrect old deposit bdv 0"
        );

        (amount, bdv) = bs.getDeposit(farmers[0], well, 4e6);
        assertEq(amount, (lpMinted - lpMinted / 2) - amounts[1], "incorrect old deposit amount 1");
        assertApproxEqAbs(
            bdv,
            bs.bdv(well, (lpMinted - lpMinted / 2) - amounts[1]),
            1,
            "incorrect old deposit bdv 1"
        );

        // verify new deposit.
        // combining a 2 equal deposits should equal a deposit with the an average of the two stems.
        (amount, bdv) = bs.getDeposit(farmers[0], well, 2e6);
        assertEq(amount, lpCombined, "new deposit dne lpMinted");
        assertApproxEqAbs(bdv, bs.bdv(well, lpCombined), 2, "new deposit dne bdv");
    }

    //////////// UNRIPE_BEAN TO UNRIPE_LP ////////////

    //////////// UNRIPE_LP TO UNRIPE_BEAN ////////////

    //////////// REVERT ON PENALTY ////////////

    // function test_convertWellToBeanRevert(uint256 deltaB, uint256 lpConverted) public {
    //     uint256 minLp = getMinLPin();
    //     uint256 lpMinted = multipleWellDepositSetup();

    //     deltaB = bound(deltaB, 1e6, 1000 ether);
    //     setReserves(well, bean.balanceOf(well) + deltaB, weth.balanceOf(well));
    //     uint256 initalWellBeanBalance = bean.balanceOf(well);
    //     uint256 initalLPbalance = MockToken(well).totalSupply();
    //     uint256 initalBeanBalance = bean.balanceOf(BEANSTALK);

    //     uint256 maxLpIn = bs.getMaxAmountIn(well, C.BEAN);
    //     lpConverted = bound(lpConverted, minLp, lpMinted / 2);

    //     // if the maximum LP that can be used is less than
    //     // the amount that the user wants to convert,
    //     // cap the amount to the maximum LP that can be used.
    //     if (lpConverted > maxLpIn) lpConverted = maxLpIn;

    //     uint256 expectedAmtOut = bs.getAmountOut(well, C.BEAN, lpConverted);

    //     // create encoding for a well -> bean convert.
    //     bytes memory convertData = convertEncoder(
    //         LibConvertData.ConvertKind.WELL_LP_TO_BEANS,
    //         well, // well
    //         lpConverted, // amountIn
    //         0 // minOut
    //     );

    //     uint256[] memory amounts = new uint256[](1);
    //     amounts[0] = lpConverted;

    //     vm.expectEmit();
    //     emit Convert(farmers[0], well, C.BEAN, lpConverted, expectedAmtOut);
    //     vm.prank(farmers[0]);
    //     convert.convert(
    //         convertData,
    //         new int96[](1),
    //         amounts
    //     );

    //     // the new maximum amount out should be the difference between the deltaB and the expected amount out.
    //     assertEq(bs.getAmountOut(well, C.BEAN, bs.getMaxAmountIn(well, C.BEAN)), deltaB - expectedAmtOut, 'amountOut does not equal deltaB - expectedAmtOut');
    //     assertEq(bean.balanceOf(well), initalWellBeanBalance - expectedAmtOut, 'well bean balance does not equal initalWellBeanBalance - expectedAmtOut');
    //     assertEq(MockToken(well).totalSupply(), initalLPbalance - lpConverted, 'well LP balance does not equal initalLPbalance - lpConverted');
    //     assertEq(bean.balanceOf(BEANSTALK), initalBeanBalance + expectedAmtOut, 'bean balance does not equal initalBeanBalance + expectedAmtOut');
    // }
}
