// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1ReceiverFacet} from "contracts/beanstalk/migration/L1ReceiverFacet.sol";
import {Order} from "contracts/beanstalk/market/MarketplaceFacet/Order.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "forge-std/console.sol";

/**
 * @notice Tests the functionality of the L1ReceiverFacet.
 */

interface IERC1555 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract L1ReceiverFacetTest is Order, TestHelper {
    using Strings for string;
    // Offset arbitrum uses for corresponding L2 address
    uint160 internal constant OFFSET = uint160(0x1111000000000000000000000000000000001111);

    address constant L2BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant L2URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant L2URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

    string constant CONTRACT_ADDRESSES_PATH =
        "./scripts/beanstalk-3/data/inputs/ContractAddresses.txt";
    uint256 constant CONTRACT_ADDRESSES_LENGTH = 47; // should be the number of lines in the file above

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
            bs.setReceiverForL1Migration(OWNER, RECIEVER);
            (
                uint256[] memory depositIds,
                uint256[] memory amounts,
                uint256[] memory bdvs
            ) = getDepositData(OWNER);

            bytes32[] memory proof = getDepositsProofForAccount(OWNER);

            // if there are no deposits, continue to next contract
            if (depositIds.length == 0) {
                // console.log("No deposits found for account, skipping:", OWNER);
                continue;
            }

            vm.prank(RECIEVER);
            L1ReceiverFacet(BEANSTALK).issueDeposits(OWNER, depositIds, amounts, bdvs, proof);
        }
    }

    function test_L2MigrateAllPlots() public {
        for (uint i; i < CONTRACT_ADDRESSES_LENGTH; i++) {
            OWNER = vm.parseAddress(vm.readLine(CONTRACT_ADDRESSES_PATH));
            RECIEVER = applyL1ToL2Alias(OWNER);
            bs.setReceiverForL1Migration(OWNER, RECIEVER);
            (uint256[] memory index, uint256[] memory pods) = getPlotData(OWNER);

            bytes32[] memory proof = getPlotsProofForAccount(OWNER);

            // if there are no indexes, continue to next contract
            if (index.length == 0) {
                console.log("No index found for account, skipping:", OWNER);
                continue;
            }

            vm.prank(RECIEVER);
            // start measuring gas
            uint256 gasBefore = gasleft();
            L1ReceiverFacet(BEANSTALK).issuePlots(OWNER, index, pods, proof);

            //stop measuring gas
            uint256 gasAfter = gasleft();
            console.log("Gas used for issuePlots:", gasBefore - gasAfter);
        }
    }

    function test_L2MigrateAllInternalBalances() public {
        for (uint i; i < CONTRACT_ADDRESSES_LENGTH; i++) {
            OWNER = vm.parseAddress(vm.readLine(CONTRACT_ADDRESSES_PATH));
            RECIEVER = applyL1ToL2Alias(OWNER);
            bs.setReceiverForL1Migration(OWNER, RECIEVER);
            (address[] memory _tokens, uint256[] memory _amounts) = getInternalBalanceData(OWNER);

            bytes32[] memory _proof = getInternalBalancesProofForAccount(OWNER);

            // if there are no indexes, continue to next contract
            if (_tokens.length == 0) {
                // console.log("No internal balances found for account, skipping:", OWNER);
                continue;
            }

            vm.prank(RECIEVER);
            L1ReceiverFacet(BEANSTALK).issueInternalBalances(OWNER, _tokens, _amounts, _proof);
        }
    }

    function test_L2MigrateAllFert() public {
        for (uint i; i < CONTRACT_ADDRESSES_LENGTH; i++) {
            OWNER = vm.parseAddress(vm.readLine(CONTRACT_ADDRESSES_PATH));
            RECIEVER = applyL1ToL2Alias(OWNER);
            bs.setReceiverForL1Migration(OWNER, RECIEVER);
            (uint256[] memory fertIds, uint128[] memory _amounts, uint128 lastBpf) = getFertData(
                OWNER
            );

            bytes32[] memory proof = getFertProofForAccount(OWNER);

            // if there are no indexes, continue to next contract
            if (fertIds.length == 0) {
                // console.log("No fert for account, skipping:", OWNER);
                continue;
            }

            vm.prank(RECIEVER);
            L1ReceiverFacet(BEANSTALK).issueFertilizer(OWNER, fertIds, _amounts, lastBpf, proof);
        }
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

    function getDepositsProofForAccount(address account) internal returns (bytes32[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/proofReaderDeposits.js";
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

    //////////////////////// PLOTS ////////////////////////

    function getPlotData(address account) internal returns (uint256[] memory, uint256[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/plotDataReader.js";
        inputs[2] = "./scripts/beanstalk-3/data/inputs/Plots.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);

        // Check if the result is empty or just "0x"
        if (result.length == 0 || (result.length == 2 && result[0] == "0" && result[1] == "x")) {
            // console.log("No plot data found for account:", account);
            return (new uint256[](0), new uint256[](0));
        }

        (uint256[] memory plotIds, uint256[] memory amounts) = abi.decode(
            result,
            (uint256[], uint256[])
        );

        return (plotIds, amounts);
    }

    function getPlotsProofForAccount(address account) internal returns (bytes32[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/proofReaderPlots.js";
        inputs[2] = "./scripts/beanstalk-3/data/merkle/plot_tree.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);
        string memory proofString = bytesToHexString(result);

        if (
            keccak256(bytes(proofString)) == keccak256(bytes("NO_PROOF_FOUND")) ||
            keccak256(bytes(proofString)) == keccak256(bytes("ERROR_READING_PROOF"))
        ) {
            return new bytes32[](0);
        }

        // Calculate the number of proof elements (each element is 64 characters long)
        uint256 numElements = bytes(proofString).length / 64;

        // Create an array with the correct size
        bytes32[] memory proof = new bytes32[](numElements);

        // Split the packed string into an array of bytes32
        for (uint256 i = 0; i < numElements; i++) {
            string memory element = substring(proofString, i * 64, (i + 1) * 64);
            proof[i] = hexStringToBytes32(element);
            console.logBytes32(proof[i]);
        }

        return proof;
    }

    //////////////////////// INTERNAL BALANCES ////////////////////////

    function getInternalBalanceData(
        address account
    ) internal returns (address[] memory, uint256[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/internalBalancesDataReader.js";
        inputs[2] = "./scripts/beanstalk-3/data/inputs/InternalBalances.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);

        // Check if the result is empty or just "0x"
        if (result.length == 0 || (result.length == 2 && result[0] == "0" && result[1] == "x")) {
            console.log("No internal balance data found for account:", account);
            return (new address[](0), new uint256[](0));
        }

        (address[] memory tokens, uint256[] memory amounts) = abi.decode(
            result,
            (address[], uint256[])
        );

        return (tokens, amounts);
    }

    function getInternalBalancesProofForAccount(
        address account
    ) internal returns (bytes32[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/proofReaderInternalBalances.js";
        inputs[2] = "./scripts/beanstalk-3/data/merkle/internal_balance_tree.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);
        string memory proofString = bytesToHexString(result);

        if (
            keccak256(bytes(proofString)) == keccak256(bytes("NO_PROOF_FOUND")) ||
            keccak256(bytes(proofString)) == keccak256(bytes("ERROR_READING_PROOF"))
        ) {
            return new bytes32[](0);
        }

        // Calculate the number of proof elements (each element is 64 characters long)
        uint256 numElements = bytes(proofString).length / 64;

        // Create an array with the correct size
        bytes32[] memory proof = new bytes32[](numElements);

        // Split the packed string into an array of bytes32
        for (uint256 i = 0; i < numElements; i++) {
            string memory element = substring(proofString, i * 64, (i + 1) * 64);
            proof[i] = hexStringToBytes32(element);
            console.logBytes32(proof[i]);
        }

        return proof;
    }

    //////////////////////// FERT ////////////////////////

    function getFertData(
        address account
    ) internal returns (uint256[] memory, uint128[] memory, uint128) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/fertDataReader.js";
        inputs[2] = "./scripts/beanstalk-3/data/inputs/Fertilizers.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);

        // Check if the result is empty or just "0x"
        if (result.length == 0 || (result.length == 2 && result[0] == "0" && result[1] == "x")) {
            console.log("No fert data found for account:", account);
            return (new uint256[](0), new uint128[](0), 0);
        }

        (uint256[] memory fertIds, uint128[] memory amounts, uint128 lastBpf) = abi.decode(
            result,
            (uint256[], uint128[], uint128)
        );

        return (fertIds, amounts, lastBpf);
    }

    function getFertProofForAccount(address account) internal returns (bytes32[] memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/beanstalk-3/proofReaderFert.js";
        inputs[2] = "./scripts/beanstalk-3/data/merkle/fert_tree.json";
        inputs[3] = Strings.toHexString(uint160(account), 20);

        bytes memory result = vm.ffi(inputs);
        string memory proofString = bytesToHexString(result);

        if (
            keccak256(bytes(proofString)) == keccak256(bytes("NO_PROOF_FOUND")) ||
            keccak256(bytes(proofString)) == keccak256(bytes("ERROR_READING_PROOF"))
        ) {
            return new bytes32[](0);
        }

        // Calculate the number of proof elements (each element is 64 characters long)
        uint256 numElements = bytes(proofString).length / 64;

        // Create an array with the correct size
        bytes32[] memory proof = new bytes32[](numElements);

        // Split the packed string into an array of bytes32
        for (uint256 i = 0; i < numElements; i++) {
            string memory element = substring(proofString, i * 64, (i + 1) * 64);
            proof[i] = hexStringToBytes32(element);
            console.logBytes32(proof[i]);
        }

        return proof;
    }

    //////////////////////// HELPER FUNCTIONS ////////////////////////

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

    function hexStringToBytes32(string memory s) internal pure returns (bytes32 result) {
        bytes memory b = bytes(s);
        require(b.length == 64, "Invalid input length");

        for (uint i = 0; i < 64; i++) {
            uint8 digit = uint8(b[i]);
            if (digit >= 48 && digit <= 57) {
                digit -= 48; // 0-9
            } else if (digit >= 65 && digit <= 70) {
                digit -= 55; // A-F
            } else if (digit >= 97 && digit <= 102) {
                digit -= 87; // a-f
            } else {
                revert("Invalid character in hex string");
            }
            result = bytes32(uint256(result) * 16 + digit);
        }
    }
}
