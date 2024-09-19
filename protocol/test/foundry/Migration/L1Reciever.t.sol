// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1RecieverFacet} from "contracts/beanstalk/migration/L1RecieverFacet.sol";
import {Order} from "contracts/beanstalk/market/MarketplaceFacet/Order.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";

/**
 * @notice Tests the functionality of the L1RecieverFacet.
 */

interface IERC1555 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract L1RecieverFacetTest is Order, TestHelper {
    // Offset arbitrum uses for corresponding L2 address
    uint160 internal constant OFFSET = uint160(0x1111000000000000000000000000000000001111);

    address constant L2BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant L2URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant L2URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

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
    function test_L2MigrateDeposits() public {
        OWNER = address(0x153072C11d6Dffc0f1e5489bC7C996c219668c67);
        RECIEVER = applyL1ToL2Alias(OWNER);

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

        assertEq(bs.balanceOfStalk(RECIEVER), 9278633023225688000000);
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

    /*
    // commented out because no pod orders owned by contracts
    function test_L2MigrateInvalidPodOrder() public {
        (
            address owner,
            L1RecieverFacet.L1PodOrder[] memory podOrders,
            bytes32[] memory proof
        ) = getMockPodOrder();
        bs.setRecieverForL1Migration(owner, RECIEVER);

        // update pod orderer
        podOrders[0].podOrder.orderer = RECIEVER;

        // verify user cannot migrate afterwords.
        vm.expectRevert("L2Migration: Invalid Order");
        vm.prank(RECIEVER);
        L1RecieverFacet(BEANSTALK).issuePodOrders(owner, podOrders, proof);
    }*/

    // test helpers
    function getMockDepositData()
        internal
        pure
        returns (address, uint256[] memory, uint256[] memory, uint256[] memory, bytes32[] memory)
    {
        address account = address(0x153072C11d6Dffc0f1e5489bC7C996c219668c67);
        uint256[] memory depositIds = new uint256[](4);
        depositIds[0] = uint256(0x1bea054dddbca12889e07b3e076f511bf1d27543000000000000000000000000);
        depositIds[1] = uint256(0x1bea054dddbca12889e07b3e076f511bf1d27543fffffffffffffffc361cfc00);
        depositIds[2] = uint256(0x1bea054dddbca12889e07b3e076f511bf1d27543fffffffffffffffa3cc8f880);
        depositIds[3] = uint256(0xbea0005b8599265d41256905a9b3073d397812e400000000000000087d50b645);

        uint256[] memory amounts = new uint256[](4);
        amounts[0] = 2;
        amounts[1] = 98145025335;
        amounts[2] = 1112719230995;
        amounts[3] = 7199435606;

        uint256[] memory bdvs = new uint256[](4);
        bdvs[0] = 0;
        bdvs[1] = 21907521429;
        bdvs[2] = 248376525588;
        bdvs[3] = 7199435606;

        bytes32[] memory proof = new bytes32[](4);
        proof[0] = bytes32(0x5ef83f1a8578311c39534b42bee1dfeb3615286ea8d88cb8d1049815df6cc280);
        proof[1] = bytes32(0x707b589c0c392e07b09601c0c055bf263f597daa15a69b2a8081d05430997682);
        proof[2] = bytes32(0x9e6eb9e0280de48adad93234edbb18284e135a06d7371391a14eed417d833523);
        proof[3] = bytes32(0x15c9ecf466aefd85d1ced579df7a8fb0219af3d27d3255e808226bbd9e219303);

        return (account, depositIds, amounts, bdvs, proof);
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
        proof[0] = bytes32(0xbaef3e12a2feef6cdf5bf77dbc0274421b66278087273b06a1b7b9be6e4de62d);
        proof[1] = bytes32(0xa2bf812102fee36e8db0bd0c3288a59e3119f9b631f2c33f95c4f12baddca96d);
        proof[2] = bytes32(0xf8138f4b12984d61c5fe1a0f360d005fdef03cc9e06f1dd67c9f98700a5532c2);

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

    /*function getMockPodOrder()
        internal
        returns (address, L1RecieverFacet.L1PodOrder[] memory, bytes32[] memory)
    {
        address account = address(0x000000009d3a9e5C7C620514E1F36905c4eb91e4);

        L1RecieverFacet.L1PodOrder[] memory podOrders = new L1RecieverFacet.L1PodOrder[](1);
        podOrders[0] = L1RecieverFacet.L1PodOrder(
            Order.PodOrder(account, 1, 100000, 1000000000000, 1000000),
            1000000
        );

        bytes32[] memory proof = new bytes32[](3);
        proof[0] = bytes32(0x9887e2354e3cdb5d01aff524d71607cfdf3c4293c6f5711c806277fee5ad2063);
        proof[1] = bytes32(0xe7d5a9eada9ddd23ca981cb62c1c0668339becddfdd69c463ae63ee3ebbdf50f);
        proof[2] = bytes32(0x9dc791f184484213529aa44fad0074c356eb252777a3c9b0516efaf0fd740650);

        return (account, podOrders, proof);
    }*/

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
