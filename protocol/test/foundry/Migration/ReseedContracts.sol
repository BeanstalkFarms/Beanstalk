// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1RecieverFacet} from "contracts/beanstalk/migration/L1RecieverFacet.sol";
import {Order} from "contracts/beanstalk/market/MarketplaceFacet/Order.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "forge-std/console.sol";

/**
 * @notice Tests the functionality of the L1RecieverFacet.
 */

interface IERC1555 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract L1RecieverFacetTest is Order, TestHelper {
    using Strings for string;
    // Offset arbitrum uses for corresponding L2 address
    uint160 internal constant OFFSET = uint160(0x1111000000000000000000000000000000001111);

    address constant L2BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant L2URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant L2URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

    string constant CONTRACT_ADDRESSES_PATH =
        "./scripts/beanstalk-3/data/inputs/ContractAddresses.txt";
    uint256 constant CONTRACT_ADDRESSES_LENGTH = 47; // should be the number of lines in the file above

    // contracts for testing:
    // note this is the first address numerically sorted in the merkle tree
    address OWNER;
    address RECIEVER;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // setup basic whitelisting for testing
        bs.mockWhitelistToken(L2BEAN, IMockFBeanstalk.beanToBDV.selector, 10000000000, 1);
        bs.mockWhitelistToken(L2URBEAN, IMockFBeanstalk.unripeBeanToBDV.selector, 10000000000, 1);
        bs.mockWhitelistToken(L2URLP, IMockFBeanstalk.unripeLPToBDV.selector, 10000000000, 1);

        // set the milestone stem for BEAN
        bs.mockSetMilestoneStem(L2BEAN, 36462179909);
        bs.mockSetMilestoneSeason(L2BEAN, bs.season());
        bs.mockSetMilestoneStem(L2URBEAN, 0);
        bs.mockSetMilestoneSeason(L2URBEAN, bs.season());
        bs.mockSetMilestoneStem(L2URLP, 0);
        bs.mockSetMilestoneSeason(L2URLP, bs.season());
    }

    /**
     * @notice validates that an account verification works, with the correct data.
     */
    function test_L2MigrateAllDeposits() public {
        // loop through all contracts that have deposits
        for (uint i; i < CONTRACT_ADDRESSES_LENGTH; i++) {
            OWNER = vm.parseAddress(vm.readLine(CONTRACT_ADDRESSES_PATH));
            RECIEVER = applyL1ToL2Alias(OWNER);
            bs.setRecieverForL1Migration(OWNER, RECIEVER);
            (
                uint256[] memory depositIds,
                uint256[] memory amounts,
                uint256[] memory bdvs
            ) = getDepositData(OWNER);

            bytes32[] memory proof = getProofForAccount(OWNER);

            // if there are no deposits, continue to next contract
            if (depositIds.length == 0) {
                // console.log("No deposits found for account, skipping:", OWNER);
                continue;
            }

            vm.prank(RECIEVER);
            L1RecieverFacet(BEANSTALK).issueDeposits(OWNER, depositIds, amounts, bdvs, proof);
        }
    }

    function test_L2MigratePlots() public {
        OWNER = address(0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7);
        RECIEVER = applyL1ToL2Alias(OWNER);
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
        OWNER = address(0x20DB9F8c46f9cD438Bfd65e09297350a8CDB0F95);
        RECIEVER = applyL1ToL2Alias(OWNER);
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
        OWNER = address(0x735CAB9B02Fd153174763958FFb4E0a971DD7f29);
        RECIEVER = applyL1ToL2Alias(OWNER);
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

        assertEq(IERC1555(fertilizerAddress).balanceOf(RECIEVER, ids[0]), amounts[0]);

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Fertilizer have been migrated");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueFertilizer(owner, ids, amounts, lastBpf, proof);
    }

    /*
    // commented out because no pod orders owned by contracts
    function test_L2MigratePodOrder() public {
        bs.setRecieverForL1Migration(address(0x000000009d3a9e5C7C620514E1F36905c4eb91e4), RECIEVER);

        (
            address owner,
            L1RecieverFacet.L1PodOrder[] memory podOrders,
            bytes32[] memory proof
        ) = getMockPodOrder();

        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issuePodOrders(
            address(0x000000009d3a9e5C7C620514E1F36905c4eb91e4),
            podOrders,
            proof
        );

        // update pod order with reciever to verify id:
        podOrders[0].podOrder.orderer = RECIEVER;

        bytes32 id = _getOrderId(podOrders[0].podOrder);

        assertEq(bs.getPodOrder(id), podOrders[0].beanAmount);

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Orders have been migrated");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issuePodOrders(owner, podOrders, proof);
    }*/

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

    /**
     * @notice verifies that a user cannot gain an invalid plot.
     */
    function test_L2MigrateInvalidPlot() public {
        OWNER = address(0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7);
        RECIEVER = applyL1ToL2Alias(OWNER);
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            uint256[] memory index,
            uint256[] memory pods,
            bytes32[] memory proof
        ) = getMockPlot();

        pods[0] = type(uint256).max;

        vm.expectRevert("L2Migration: Invalid plots");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issuePlots(owner, index, pods, proof);
    }

    function test_L2MigrateInvalidInternalBalance() public {
        OWNER = address(0x20DB9F8c46f9cD438Bfd65e09297350a8CDB0F95);
        RECIEVER = applyL1ToL2Alias(OWNER);
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            address[] memory tokens,
            uint256[] memory amounts,
            bytes32[] memory proof
        ) = getMockInternalBalance();

        amounts[0] = type(uint256).max;

        vm.expectRevert("L2Migration: Invalid internal balances");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueInternalBalances(owner, tokens, amounts, proof);
    }

    function test_L2MigrateInvalidFert() public {
        OWNER = address(0x735CAB9B02Fd153174763958FFb4E0a971DD7f29);
        RECIEVER = applyL1ToL2Alias(OWNER);
        bs.setRecieverForL1Migration(OWNER, RECIEVER);

        (
            address owner,
            uint256[] memory ids,
            uint128[] memory amounts,
            uint128 lastBpf,
            bytes32[] memory proof
        ) = getMockFertilizer();

        amounts[0] = type(uint128).max;

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Invalid Fertilizer");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issueFertilizer(owner, ids, amounts, lastBpf, proof);
    }

    function decodeDepositData(
        bytes memory data
    ) external pure returns (IMockFBeanstalk.TokenDepositId[] memory) {
        return abi.decode(data, (IMockFBeanstalk.TokenDepositId[]));
    }

    function getMockPlot()
        internal
        returns (address, uint256[] memory, uint256[] memory, bytes32[] memory)
    {
        address account = address(0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7);

        uint256[] memory index = new uint256[](6);
        index[0] = 633990925883216;
        index[1] = 649972854809057;
        index[2] = 666992136712860;
        index[3] = 696658166381444;
        index[4] = 696966636250825;
        index[5] = 707711446117109;

        uint256[] memory pods = new uint256[](6);
        pods[0] = 13743931655;
        pods[1] = 310402500;
        pods[2] = 5130435000;
        pods[3] = 39926484;
        pods[4] = 2347857;
        pods[5] = 1525000;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0xce6c05520ca960525c486ec28de7ab8018c0d094a404feb043b60ef658e1e921);
        proof[1] = bytes32(0x804c830f86722b4afe4c1e19fe9445e7b1087969871708451c204d4a1a333789);
        proof[2] = bytes32(0xe59a902f19ff32a47a5eac21bb2642fb0e6c695edfed938122aed52a46a635c3);

        return (account, index, pods, proof);
    }

    function getMockInternalBalance()
        internal
        returns (address, address[] memory, uint256[] memory, bytes32[] memory)
    {
        address account = address(0x20DB9F8c46f9cD438Bfd65e09297350a8CDB0F95);

        address[] memory tokens = new address[](1);
        tokens[0] = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 8568;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0xe6b126b486d1049a3c4ea6d32708dedf47b9d508d591671eddd7214476914f69);
        proof[1] = bytes32(0x88659cfb1b3bec548b7ac3b0c5dd1ff653cbc33e3a12e10fd6e7a554a0402f46);
        proof[2] = bytes32(0x18679f0b3b62978601eb10e75699f4a869665f734fcca4c304a4d639e2c32f26);

        return (account, tokens, amounts, proof);
    }

    function getMockFertilizer()
        internal
        returns (address, uint256[] memory, uint128[] memory, uint128, bytes32[] memory)
    {
        address account = address(0x735CAB9B02Fd153174763958FFb4E0a971DD7f29);

        uint256[] memory ids = new uint256[](4);
        ids[0] = 3458512;
        ids[1] = 3458531;
        ids[2] = 3470220;
        ids[3] = 6000000;

        uint128[] memory amounts = new uint128[](4);
        amounts[0] = 542767;
        amounts[1] = 56044;
        amounts[2] = 291896;
        amounts[3] = 8046712;

        uint128 lastBpf = 340802;

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0x044efadc8244d78f08686bb10b22ee313b8331aefafc0badffbb74c0558e3f8a);
        proof[1] = bytes32(0xf6e0807e42179f8c975067c891e93ac48621024dc25b223baf4a78f0edcfa61d);
        proof[2] = bytes32(0x7e77601c08f8772a9cf44337db2696d84da8290be446b231dc70c4289526a4d9);

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

    //////////////////////// DEPOSITS ////////////////////////

    // test helpers
    function getDepositData(
        address account
    ) internal returns (uint256[] memory, uint256[] memory, uint256[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/depositDataReader.js";
        inputs[2] = "./scripts/beanstalk-3/data/inputs/Deposits.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);

        // Check if the result is empty or just "0x"
        if (result.length == 0 || (result.length == 2 && result[0] == "0" && result[1] == "x")) {
            // console.log("No deposit data found for account:", account);
            return (new uint256[](0), new uint256[](0), new uint256[](0));
        }

        (uint256[] memory depositIds, uint256[] memory amounts, uint256[] memory bdvs) = abi.decode(
            result,
            (uint256[], uint256[], uint256[])
        );

        return (depositIds, amounts, bdvs);
    }

    function getAllDeposits(
        address account
    ) internal returns (IMockFBeanstalk.TokenDepositId[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/depositFinder.js"; // existing script
        inputs[2] = "./reseed/data/exports/storage-accounts20736200.json"; // json file
        inputs[3] = vm.toString(account);
        bytes memory encodedData = vm.ffi(inputs);

        if (encodedData.length == 0) {
            return new IMockFBeanstalk.TokenDepositId[](0);
        }

        return abi.decode(encodedData, (IMockFBeanstalk.TokenDepositId[]));
    }

    function hexStringToBytes32(string memory s) internal pure returns (bytes32 result) {
        bytes memory b = bytes(s);
        require(b.length == 64, "Invalid input length");

        for (uint i = 0; i < 64; i++) {
            uint8 digit = uint8(b[i]);
            // console.log("Processing character:", string(abi.encodePacked(b[i])));
            // console.log("ASCII value:", digit);

            if (digit >= 48 && digit <= 57) {
                digit -= 48; // 0-9
            } else if (digit >= 65 && digit <= 70) {
                digit -= 55; // A-F
            } else if (digit >= 97 && digit <= 102) {
                digit -= 87; // a-f
            } else {
                // console.log("Invalid character found at position:", i);
                // console.log("Invalid character:", string(abi.encodePacked(b[i])));
                // console.log("ASCII value of invalid character:", digit);
                revert("Invalid character in hex string");
            }
            result = bytes32(uint256(result) * 16 + digit);
        }
    }

    function getProofForAccount(address account) internal returns (bytes32[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/proofReader.js";
        inputs[2] = "./scripts/beanstalk-3/data/merkle/deposit_tree.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);

        // Convert raw bytes to hex string
        string memory proofString = bytesToHexString(result);

        if (
            keccak256(bytes(proofString)) == keccak256(bytes("NO_PROOF_FOUND")) ||
            keccak256(bytes(proofString)) == keccak256(bytes("ERROR_READING_PROOF"))
        ) {
            return new bytes32[](0);
        }

        // Calculate the number of proof elements (each element is 64 characters long)
        uint256 numElements = bytes(proofString).length / 64;
        // console.log("Number of elements:", numElements);

        // Create an array with the correct size
        bytes32[] memory proof = new bytes32[](numElements);

        // Split the packed string into an array of bytes32
        for (uint256 i = 0; i < numElements; i++) {
            string memory element = substring(proofString, i * 64, (i + 1) * 64);
            // console.log("Processing element:", i);
            // console.log("Element string:", element);
            proof[i] = hexStringToBytes32(element);
            // console.log("Processed proof element:");
            console.logBytes32(proof[i]);
        }

        return proof;
    }

    function bytesToHexString(bytes memory data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(data.length * 2);
        for (uint i = 0; i < data.length; i++) {
            result[i * 2] = hexChars[uint8(data[i] >> 4)];
            result[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(result);
    }

    function substring(
        string memory str,
        uint256 startIndex,
        uint256 endIndex
    ) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }
}
