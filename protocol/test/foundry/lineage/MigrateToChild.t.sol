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
    function test_migrateDeposits(uint256 amount) public {
        amount = bound(amount, 100, 10_000_000e6);
        address user = farmers[2];
        mintTokensToUser(user, C.BEAN, amount);
        depositForUser(user, C.BEAN, amount);
        int96 stem = bs.stemTipForToken(C.BEAN);
        passGermination();
        // Capture Source state.
        (uint256 sourceDepositAmount, uint256 sourceDepositBdv) = bs.getDeposit(user, C.BEAN, stem);
        // Capture Destination state.
        // Migrate.
        uint256 firstMigrationAmount = amount / 10;
        uint256 secondMigrationAmount = amount - firstMigrationAmount;
        IMockFBeanstalk.SourceDeposit[] memory deposits = new IMockFBeanstalk.SourceDeposit[](2);
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

        vm.prank(user);
        bs.migrateOut(
            // TODO change to not migrate into self
            BEANSTALK, // Migrate into self
            deposits,
            new IMockFBeanstalk.SourcePlot[](0),
            new IMockFBeanstalk.SourceFertilizer[](0),
            abi.encode("")
        );
        int96 destinationStem = bs.stemTipForToken(C.BEAN);
        // Validate Source state.
        // Validate Destination state.
        (uint256 destinationDepositAmount, uint256 destinationDepositBdv) = bs.getDeposit(
            user,
            C.BEAN,
            destinationStem
        );
        require(sourceDepositAmount == destinationDepositAmount, "Deposit amount mismatch");
        require(sourceDepositBdv == destinationDepositBdv, "Deposit bdv mismatch");
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
