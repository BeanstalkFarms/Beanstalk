// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {C} from "contracts/C.sol";
import {TestHelper} from "test/foundry/utils/TestHelper.sol";
import {LibMigrateOut} from "contracts/libraries/Lineage/LibMigrateOut.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {BeanstalkDeployer} from "test/foundry/utils/BeanstalkDeployer.sol";

/**
 * @notice Tests a migration from a Source to Destination Beanstalk.
 */
contract MigrateToChildTest is TestHelper {
    // test accounts
    address[] farmers;
    address payable newBeanstalk;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

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
        mintTokensToUsers(farmers, C.BEAN, 10_000e6);
        passGermination();

        // setUpSiloDepositTest(10_000e6, farmers);
        addFertilizerBasedOnSprouts(0, 100e6);
        sowAmountForFarmer(farmers[0], 1_000e6);

        // // Deploy new Beanstalk.
        // BeanstalkDeployer childDeployer = new BeanstalkDeployer();
        // // initMockBean(C.BEAN, verbose);
        // newBeanstalk = payable(address(0x69));
        // childDeployer.setupDiamond(newBeanstalk, false, true);
    }

    /**
     * @notice Performs migrations that should revert.
     * @dev Can revert at source if assets do not exist or destination if assets not compatible.
     */
    // function test_migrateRevert() public {}

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
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
        }

        vm.prank(user);
        bs.migrateOut(
            // TODO change to not migrate into self
            BEANSTALK, // Migrate into self
            deposits,
            new IMockFBeanstalk.SourcePlot[](0),
            new IMockFBeanstalk.SourceFertilizer[](0),
            abi.encode("")
        );

        // NOTE: Cannot do this yet, bc source == destination.
        // // Verify Source deposits.
        // {
        //     (uint256 sourceDepositAmount, uint256 sourceDepositBdv) = bs.getDeposit(
        //         user,
        //         C.BEAN,
        //         stem
        //     );
        //     require(sourceDepositAmount == 0, "Source deposit amount mismatch");
        //     require(sourceDepositBdv == 0, "Source deposit bdv mismatch");
        // }
        // Verify Destination deposits.
        {
            int96 destinationStem = stem;
            (uint256 destinationDepositAmount, uint256 destinationDepositBdv) = bs.getDeposit(
                user,
                C.BEAN,
                destinationStem
            );
            require(depositAmount == destinationDepositAmount, "Dest deposit amount mismatch");
            require(depositBdv == destinationDepositBdv, "Dest deposit bdv mismatch");
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    // function test_migratePlots() public {}

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    // function test_migrateFertilizer() public {}

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    // function test_migrateAll() public {}
}
