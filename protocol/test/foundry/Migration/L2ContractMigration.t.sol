// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L2ContractMigrationFacet} from "contracts/beanstalk/silo/L2ContractMigrationFacet.sol";

/**
 * @notice Tests the functionality of the L2ContractMigrationFacet.
 */
contract L2ContractMigrationTest is TestHelper {
    // contracts for testing:
    address constant TEST_ACCOUNT = address(0x000000009D3a9E5c7C620514E1F36905C4eb91e5);

    uint256 SIG_TEST_ACCOUNT_PK = 123456789;

    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }

    /**
     * @notice validates that an account verification works, with the correct data.
     */
    function test_valid_migration_data() public {
        (
            L2ContractMigrationFacet.AccountDepositData[] memory accountDepositData,
            L2ContractMigrationFacet.AccountInternalBalance[] memory accountInternalBalance,
            bytes32[] memory proof
        ) = get_mock_migration_data();

        L2ContractMigrationFacet(BEANSTALK).verifyMigrationDepositsAndInternalBalances(
            TEST_ACCOUNT,
            accountDepositData,
            accountInternalBalance,
            0,
            proof
        );
    }

    /**
     * @notice reverts on invalid data input.
     */
    function test_invalid_migration_data() public {
        (
            L2ContractMigrationFacet.AccountDepositData[] memory accountDepositData,
            L2ContractMigrationFacet.AccountInternalBalance[] memory accountInternalBalance,
            bytes32[] memory proof
        ) = get_mock_migration_data();

        vm.expectRevert();
        L2ContractMigrationFacet(BEANSTALK).verifyMigrationDepositsAndInternalBalances(
            TEST_ACCOUNT,
            accountDepositData,
            accountInternalBalance,
            1,
            proof
        );
    }

    // test helpers
    function get_mock_migration_data()
        internal
        returns (
            L2ContractMigrationFacet.AccountDepositData[] memory accountDepositData,
            L2ContractMigrationFacet.AccountInternalBalance[] memory accountInternalBalance,
            bytes32[] memory proof
        )
    {
        accountDepositData = new L2ContractMigrationFacet.AccountDepositData[](1);
        accountDepositData[0].token = C.BEAN;
        accountDepositData[0].depositIds = new uint256[](1);
        accountDepositData[0].depositIds[0] = uint256(
            0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab000000000000000000F4240
        );
        accountDepositData[0].amounts = new uint128[](1);
        accountDepositData[0].amounts[0] = 1e6;
        accountDepositData[0].bdvs = new uint128[](1);
        accountDepositData[0].bdvs[0] = 1e6;

        accountInternalBalance = new L2ContractMigrationFacet.AccountInternalBalance[](1);
        accountInternalBalance[0].token = C.BEAN;
        accountInternalBalance[0].amount = 10e6;

        proof = new bytes32[](2);
        proof[0] = 0x887d05d7170b6de140cdbc78ff277b9d8b6c32e149a81e0ad20c66c9d9f529a5;
        proof[1] = 0xbe1903190850685bec6a455cd5d579388dbe2237ed2ad2df5334fd2cb9d4d23a;
    }
}
