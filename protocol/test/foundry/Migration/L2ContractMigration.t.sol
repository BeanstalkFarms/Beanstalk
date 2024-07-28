// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1RecieverFacet} from "contracts/beanstalk/migration/L1RecieverFacet.sol";

/**
 * @notice Tests the functionality of the L1RecieverFacet.
 */
contract L1RecieverFacetTest is TestHelper {
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
            address owner,
            uint256[] memory depositIds,
            uint256[] memory depositAmounts,
            uint256[] memory bdvs,
            uint256 stalk,
            bytes32[] memory proof
        ) = getMockDepositData();

        L1RecieverFacet(BEANSTALK).issueDeposits(
            owner,
            depositIds,
            depositAmounts,
            bdvs,
            stalk,
            proof
        );
    }

    // /**
    //  * @notice reverts on invalid data input.
    //  */
    // function test_invalid_migration_data() public {
    //     (
    //         L2ContractMigrationFacet.AccountDepositData[] memory accountDepositData,
    //         L2ContractMigrationFacet.AccountInternalBalance[] memory accountInternalBalance,
    //         bytes32[] memory proof
    //     ) = get_mock_migration_data();

    //     vm.expectRevert();
    //     L2ContractMigrationFacet(BEANSTALK).verifyMigrationDepositsAndInternalBalances(
    //         TEST_ACCOUNT,
    //         accountDepositData,
    //         accountInternalBalance,
    //         1,
    //         proof
    //     );
    // }

    // test helpers
    function getMockDepositData()
        internal
        returns (
            address,
            uint256[] memory,
            uint256[] memory,
            uint256[] memory,
            uint256,
            bytes32[] memory
        )
    {
        address account = address(0x000000009d3a9e5C7c620514e1f36905C4Eb91e1);
        uint256[] memory depositIds = new uint256[](1);
        depositIds[0] = uint256(0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab000000000000000000F4240);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000000;

        uint256[] memory bdvs = new uint256[](1);
        bdvs[0] = 1000000;

        uint256 stalk = 1000000000000;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0xea7b6ec6adf4bf0ed261310624aa3ae4a7a2bbed9fa4fb3c6c954ac210c885dc);
        proof[1] = bytes32(0x6cfc3b17d940272292defb965ecba31d829ef7ca2d390f6dd684a0baac7048e8);
        proof[2] = bytes32(0x0bbbb949dfd91d793b423ed5bea05900c0e3e0817b5ce8aef6ae6a86610ab4c9);

        return (account, depositIds, amounts, bdvs, stalk, proof);
    }
}
