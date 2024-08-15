// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {C} from "contracts/C.sol";
import {LibAltC} from "test/foundry/utils/LibAltC.sol";
import {LibConstant} from "test/foundry/utils/LibConstant.sol";
import {TestHelper} from "test/foundry/utils/TestHelper.sol";
import {LibMigrateOut} from "contracts/libraries/Lineage/LibMigrateOut.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {BeanstalkDeployer} from "test/foundry/utils/BeanstalkDeployer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Tests migrations to a child fork from og Beanstalk.
 */
contract MigrateToForkTest is TestHelper {
    IMockFBeanstalk newBs;
    address NEW_BEANSTALK;

    uint32 constant REPLANT_SEASON = 6074;

    address ZERO_ADDR = LibConstant.ZERO_ADDRESS;

    // test accounts
    address[] farmers;
    address payable newBeanstalk;

    function setUp() public {
        initializeBeanstalkTestState(true, false, false);

        farmers = createUsers(3);

        // max approve.
        maxApproveBeanstalk(farmers);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            C.BEAN_ETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        addLiquidityToWell(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );
        initializeUnripeTokens(farmers[0], 100e6, 100e18);
        bs.fastForward(REPLANT_SEASON);

        setUpSiloDeposits(10_000e6, farmers);
        passGermination();

        addFertilizerBasedOnSprouts(REPLANT_SEASON, 100e6);

        // Deploy new Beanstalk fork.
        TestHelper altEcosystem = new TestHelper();
        altEcosystem.initializeBeanstalkTestState(true, true, false);
        altEcosystem.addLiquidityToWell(
            C.BEAN_ETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );
        altEcosystem.addLiquidityToWell(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        newBs = IMockFBeanstalk(altEcosystem.bs());
        NEW_BEANSTALK = address(newBs);
        newBs.fastForward(100);
    }

    /**
     * @notice Performs migrations that should revert.
     * @dev Can revert at source if assets do not exist or destination if assets not compatible.
     */
    // function test_migrateRevert() public {}

    /**
     * @notice Performs a migration of all asset types from a Source to Destination fork.
     */
    function test_migrateDeposits(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 100, 10_000_000e6);
        address user = farmers[2];

        depositForUser(user, C.BEAN, depositAmount);
        int96 stem = bs.stemTipForToken(C.BEAN);
        passGermination();

        // Capture Source state.
        (uint256 depositAmount, uint256 depositBdv) = bs.getDeposit(user, C.BEAN, stem);

        IMockFBeanstalk.SourceDeposit[] memory deposits = new IMockFBeanstalk.SourceDeposit[](2);
        {
            uint256 firstMigrationAmount = depositAmount / 10;
            uint256 secondMigrationAmount = depositAmount - firstMigrationAmount;
            deposits[0] = IMockFBeanstalk.SourceDeposit(
                C.BEAN,
                firstMigrationAmount,
                stem,
                new uint256[](2), // Not used for Bean deposits.
                0, // Not used for Bean deposits.
                0, // populated by source
                0, // populated by source
                address(0), // populated by source
                0 // populated by source
            );
            deposits[1] = IMockFBeanstalk.SourceDeposit(
                C.BEAN,
                secondMigrationAmount,
                stem,
                new uint256[](2), // Not used for Bean deposits.
                0, // Not used for Bean deposits.
                0, // populated by source
                0, // populated by source
                address(0), // populated by source
                0 // populated by source
            );
            // Check events for burning and minting of bean token.
            vm.expectEmit();
            emit IERC20.Transfer(BEANSTALK, ZERO_ADDR, firstMigrationAmount);
            vm.expectEmit();
            emit IERC20.Transfer(BEANSTALK, ZERO_ADDR, secondMigrationAmount);
            vm.expectEmit();
            emit IERC20.Transfer(ZERO_ADDR, NEW_BEANSTALK, firstMigrationAmount);
            vm.expectEmit();
            emit IERC20.Transfer(ZERO_ADDR, NEW_BEANSTALK, secondMigrationAmount);
        }

        vm.prank(user);
        bs.migrateOut(
            NEW_BEANSTALK,
            deposits,
            new IMockFBeanstalk.SourcePlot[](0),
            new IMockFBeanstalk.SourceFertilizer[](0),
            abi.encode("")
        );

        // Verify Source deposits.
        {
            (uint256 sourceDepositAmount, uint256 sourceDepositBdv) = bs.getDeposit(
                user,
                C.BEAN,
                stem
            );
            require(sourceDepositAmount == 0, "Source deposit amount mismatch");
            require(sourceDepositBdv == 0, "Source deposit bdv mismatch");
        }
        // Verify Destination deposits.
        {
            uint256[] memory destDepositIds = newBs
                .getTokenDepositsForAccount(user, C.BEAN)
                .depositIds;
            require(destDepositIds.length == 1, "Dest deposit count mismatch");
            (address token, int96 stem) = LibBytes.unpackAddressAndStem(destDepositIds[0]);
            (uint256 destinationDepositAmount, uint256 destinationDepositBdv) = newBs.getDeposit(
                user,
                C.BEAN, // TODO: Can this be made into a new Bean token?
                stem
            );
            require(stem < newBs.stemTipForToken(token), "Dest deposit stem too high");
            require(depositAmount == destinationDepositAmount, "Dest deposit amount mismatch");
            require(depositBdv == destinationDepositBdv, "Dest deposit bdv mismatch");
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    function test_migratePlots(uint256 sowAmount) public {
        sowAmount = bound(sowAmount, 100, 1000e6);
        address user = farmers[2];

        uint256 podsPerSow = sowForUser(user, sowAmount);
        uint256 halfPlot = podsPerSow / 2;
        sowForUser(user, sowAmount);

        IMockFBeanstalk.SourcePlot[] memory plots = new IMockFBeanstalk.SourcePlot[](2);
        {
            // Initial Migration of a Plot. With index != 0.
            plots[0] = IMockFBeanstalk.SourcePlot(
                0, // fieldId
                podsPerSow, // plotId
                podsPerSow, // amount
                0 // prevDestIndex
            );
            // Migration of a plot prior to latest migrated plot.
            plots[1] = IMockFBeanstalk.SourcePlot(
                0, // fieldId
                0, // plotId
                halfPlot, // amount
                0 // prevDestIndex
            );
        }

        vm.prank(user);
        bs.migrateOut(
            // TODO change to not migrate into self, but this requires significant changes to initialization system.
            NEW_BEANSTALK, // Migrate into self
            new IMockFBeanstalk.SourceDeposit[](0),
            plots,
            new IMockFBeanstalk.SourceFertilizer[](0),
            abi.encode("")
        );

        // Verify Source plots.
        {
            require(bs.plot(user, 0, 0) == 0, "1st src plot amount");
            require(bs.plot(user, 0, podsPerSow) == halfPlot, "2nd src plot amount");
            require(bs.plot(user, 0, podsPerSow + halfPlot) == halfPlot, "2.5 src plot amount");
            require(bs.plot(ZERO_ADDR, 0, 0) == podsPerSow, "1st src null plot amount");
            require(bs.plot(ZERO_ADDR, 0, podsPerSow) == halfPlot, "2nd src null plot amount");
        }
        // Verify Destination plots.
        {
            require(newBs.plot(user, 0, 0) == podsPerSow, "1st src plot amount");
            require(newBs.plot(user, 0, podsPerSow) == podsPerSow, "2nd src plot amount");
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination fork.
     */
    function test_migrateFertilizer(uint256 ethAmount) public {
        address user = farmers[2];

        uint128 firstId = bs.getEndBpf();
        uint256 firstFertAmount = buyFertForUser(user, ethAmount);
        passGermination();
        uint128 secondId = bs.getEndBpf();
        uint256 secondFertAmount = buyFertForUser(user, ethAmount);

        IMockFBeanstalk.SourceFertilizer[] memory ferts = new IMockFBeanstalk.SourceFertilizer[](2);
        {
            firstFertAmount /= 3;
            ferts[0] = IMockFBeanstalk.SourceFertilizer(
                firstId, // id
                firstFertAmount, // amount
                0 // _remainingBpf
            );
            ferts[1] = IMockFBeanstalk.SourceFertilizer(
                secondId, // id
                secondFertAmount, // amount
                0 // _remainingBpf
            );
        }

        vm.prank(user);
        bs.migrateOut(
            // TODO change to not migrate into self, but this requires significant changes to initialization system.
            BEANSTALK, // Migrate into self
            new IMockFBeanstalk.SourceDeposit[](0),
            new IMockFBeanstalk.SourcePlot[](0),
            ferts,
            abi.encode("")
        );

        // NOTE: Cannot do this yet, bc source == destination.
        // // Verify Source fertilizer.
        // {
        //     require(bs.plot(user, 0, 0) == 0, "First source plot amount mismatch");
        //     require(bs.plot(user, 0, podsPerSow) == 0, "Second source plot amount mismatch");
        // }
        // Verify Destination fertilizer.
        {
            // require(fertilizer.balanceOf(user, firstId) == firstFertAmount, "Dest fert amount mismatch");
            require(
                fertilizer.balanceOf(user, secondId) == secondFertAmount,
                "Dest fert amount mismatch"
            );
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    // function test_migrateAll() public {}
}
