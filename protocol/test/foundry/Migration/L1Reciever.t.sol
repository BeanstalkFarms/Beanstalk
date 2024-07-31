// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1RecieverFacet} from "contracts/beanstalk/migration/L1RecieverFacet.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";

/**
 * @notice Tests the functionality of the L1RecieverFacet.
 */

interface IERC1555 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract L1RecieverFacetTest is TestHelper {
    // contracts for testing:
    address constant OWNER = address(0x000000009d3a9e5C7c620514e1f36905C4Eb91e1);
    address constant RECIEVER = address(0x000000009D3a9E5c7C620514E1F36905C4eb91e5);

    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }

    /**
     * @notice validates that an account verification works, with the correct data.
     */
    function test_L2MigrateDeposits() public {
        // skip sunrises such that stemTip > 0:
        bs.fastForward(100);
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            uint256[] memory depositIds,
            uint256[] memory depositAmounts,
            uint256[] memory bdvs,
            bytes32[] memory proof
        ) = getMockDepositData();

        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueDeposits(owner, depositIds, depositAmounts, bdvs, proof);

        assertEq(bs.balanceOfStalk(RECIEVER), 10199e6);
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositIds[0]);
        (uint256 amount, uint256 bdv) = bs.getDeposit(RECIEVER, token, stem);
        assertEq(amount, depositAmounts[0]);
        assertEq(bdv, bdvs[0]);

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Deposits have been migrated");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueDeposits(owner, depositIds, depositAmounts, bdvs, proof);
    }

    function test_L2MigratePlots() public {
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            uint256[] memory index,
            uint256[] memory pods,
            bytes32[] memory proof
        ) = getMockPlot();

        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issuePlots(owner, index, pods, proof);
        uint256 amt = bs.plot(RECIEVER, 0, index[0]);
        assertEq(amt, pods[0]);

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Plots have been migrated");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issuePlots(owner, index, pods, proof);
    }

    function test_L2MigrateInternalBalances() public {
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            address[] memory tokens,
            uint256[] memory amounts,
            bytes32[] memory proof
        ) = getMockInternalBalance();

        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueInternalBalances(owner, tokens, amounts, proof);
        uint256 amount = bs.getInternalBalance(RECIEVER, tokens[0]);
        assertEq(amount, amounts[0]);
        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Internal Balances have been migrated");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueInternalBalances(owner, tokens, amounts, proof);
    }

    function test_L2MigrateFert() public {
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            uint256[] memory ids,
            uint128[] memory amounts,
            uint128 lastBpf,
            bytes32[] memory proof
        ) = getMockFertilizer();

        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueFertilizer(owner, ids, amounts, lastBpf, proof);

        assertEq(IERC1555(address(C.fertilizer())).balanceOf(RECIEVER, ids[0]), amounts[0]);

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Fertilizer have been migrated");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueFertilizer(owner, ids, amounts, lastBpf, proof);
    }

    /**
     * @notice verifies only the owner or bridge can call the migration functions.
     */
    function test_L2MigrateInvalidReciever(address reciever) public {
        vm.prank(reciever);
        vm.expectRevert("L1RecieverFacet: Invalid Caller");
        bs.approveReciever(OWNER, reciever);

        uint256 snapshot = vm.snapshot();
        address aliasedAddress = applyL1ToL2Alias(BEANSTALK);
        vm.prank(aliasedAddress);
        bs.approveReciever(OWNER, reciever);
        assertEq(bs.getReciever(OWNER), reciever);

        vm.revertTo(snapshot);
        vm.prank(users[0]);
        bs.approveReciever(OWNER, reciever);
        assertEq(bs.getReciever(OWNER), reciever);
    }

    function test_L2MigrateInvalidPlot() public {}

    function test_L2MigrateInvalidInternalBalance() public {}

    function test_L2MigrateInvalidInternalFert() public {}

    // test helpers
    function getMockDepositData()
        internal
        returns (address, uint256[] memory, uint256[] memory, uint256[] memory, bytes32[] memory)
    {
        address account = address(0x000000009d3a9e5C7c620514e1f36905C4Eb91e1);
        uint256[] memory depositIds = new uint256[](1);
        depositIds[0] = uint256(0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab0000000000000000000F4240);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000000;

        uint256[] memory bdvs = new uint256[](1);
        bdvs[0] = 1000000;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0x8ea415839f1072f235336be93f3642bbb931587b0514414f050ba28e44e863ba);
        proof[1] = bytes32(0xb6a82bb1dbec8f846d882348c50cdc2f98cc3624f3f644d766aee803f3bf54f9);
        proof[2] = bytes32(0x6bcf3ec8ed0d7643aa6aa7eb4e6355b359c24df28cfaee3ce85ccfaca5948165);

        return (account, depositIds, amounts, bdvs, proof);
    }

    function getMockPlot()
        internal
        returns (address, uint256[] memory, uint256[] memory, bytes32[] memory)
    {
        address account = address(0x000000009d3a9e5C7c620514e1f36905C4Eb91e1);

        uint256[] memory index = new uint256[](1);
        index[0] = 1000000;

        uint256[] memory pods = new uint256[](1);
        pods[0] = 1000000;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0x7fec66e420aacd9e183eccd924035325e315d9013f6f3d451bb9e858dffe90ec);
        proof[1] = bytes32(0x5dea8270f7662bd619252f3e42834dceb9f5705b6519d3eeb3739eae266b82f4);
        proof[2] = bytes32(0xc9661717e025decd79ae2e6f247415a52ff577c22bb4479239696b4d7fe0113f);

        return (account, index, pods, proof);
    }

    function getMockInternalBalance()
        internal
        returns (address, address[] memory, uint256[] memory, bytes32[] memory)
    {
        address account = address(0x000000009d3a9e5C7c620514e1f36905C4Eb91e1);

        address[] memory tokens = new address[](1);
        tokens[0] = address(0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000000;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0x6a57990edf1b67a414df7d4aec7b52e1c47286a03509d9c6f15a16b756a5de66);
        proof[1] = bytes32(0x71d925b5e0154ae1869b233f58af5d6e9dbaa13be37c15c96e7a2349c7022ca6);
        proof[2] = bytes32(0xafd548122a5e2e140737734c83cafd8d7299227d41232014a13e8454719fa366);

        return (account, tokens, amounts, proof);
    }

    function getMockFertilizer()
        internal
        returns (address, uint256[] memory, uint128[] memory, uint128, bytes32[] memory)
    {
        address account = address(0x000000009d3a9e5C7c620514e1f36905C4Eb91e1);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1000000;

        uint128[] memory amounts = new uint128[](1);
        amounts[0] = 1000000;

        uint128 lastBpf = 1000000000000;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0xd19d28ef2a071aa639c9393027a37d79d5fe98d72e92e3503e15919f197d2d85);
        proof[1] = bytes32(0xb2de5943ed868a3e93502a344d36169678c761d3cc408a7b5b264c6fe9b3a4e9);
        proof[2] = bytes32(0x0a2ec57dfd306a0e6b245cde079298f849cda3a3ba90016fa3216aac66a9ede3);

        return (account, ids, amounts, lastBpf, proof);
    }

    /**
     * @notice Utility function that converts the address in the L1 that submitted a tx to
     * the inbox to the msg.sender viewed in the L2
     * @param l1Address the address in the L1 that triggered the tx to L2
     * @return l2Address L2 address as viewed in msg.sender
     */
    function applyL1ToL2Alias(address l1Address) internal pure returns (address l2Address) {
        unchecked {
            l2Address = address(
                uint160(l1Address) + uint160(0x1111000000000000000000000000000000001111)
            );
        }
    }
}
