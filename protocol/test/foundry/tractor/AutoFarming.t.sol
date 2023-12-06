// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// import "test/foundry/utils/TestHelper.sol";

import "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {C} from "contracts/C.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibDrafter, ARRAY_LENGTH} from "contracts/libraries/LibDrafter.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {IBeanstalk} from "contracts/interfaces/IBeanstalk.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {TokenFacet} from "contracts/beanstalk/farm/TokenFacet.sol";
import {TractorFacet} from "contracts/beanstalk/farm/TractorFacet.sol";
import {JunctionFacet} from "contracts/beanstalk/junction/JunctionFacet.sol";
import {InitTractor} from "contracts/beanstalk/init/InitTractor.sol";
import {TestHelper} from "test/foundry/utils/TestHelper.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";

contract TractorTest is TestHelper {
    uint256 private constant PUBLISHER_PRIVATE_KEY = 123456789;

    // Random address with enrootable stalk in block 18713513 : 0x56A201b872B50bBdEe0021ed4D1bb36359D291ED
    address private PUBLISHER;
    address private constant OPERATOR = address(982340983475);

    address private constant BEANSTALK = address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);
    address private constant BEANSTALK_OWNER = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

    IBeanstalk beanstalk;
    IERC20 bean;

    TractorFacet tractorFacet;
    JunctionFacet junctionFacet;
    TokenFacet tokenFacet;

    function setUp() public {
        vm.createSelectFork({urlOrAlias: "mainnet", blockNumber: 18_686_631});

        beanstalk = IBeanstalk(BEANSTALK);
        bean = IERC20(C.BEAN);
        tokenFacet = TokenFacet(BEANSTALK);

        PUBLISHER = vm.addr(PUBLISHER_PRIVATE_KEY);

        // Cut and init TractorFacet.
        InitTractor initTractor = new InitTractor();
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = _cut("TractorFacet", address(new TractorFacet()));
        vm.prank(BEANSTALK_OWNER); // LibAppStorage.diamondStorage().contractOwner
        IDiamondCut(BEANSTALK).diamondCut(
            cut,
            address(initTractor), // address of contract with init() function
            abi.encodeWithSignature("init()")
        );
        tractorFacet = TractorFacet(BEANSTALK);

        // Cut and init JunctionFacet.
        cut = new IDiamondCut.FacetCut[](1);
        cut[0] = _cut("JunctionFacet", address(new JunctionFacet()));
        vm.prank(BEANSTALK_OWNER); // LibAppStorage.diamondStorage().contractOwner
        IDiamondCut(BEANSTALK).diamondCut(
            cut,
            address(0), // address of contract with init() function
            ""
        );
        junctionFacet = JunctionFacet(BEANSTALK);

        // Mint beans
        // vm.prank(0x62d69f6867A0A084C6d313943dC22023Bc263691);
        deal(C.BEAN, PUBLISHER, 5000e6);
        console.log("Bean supply is", C.bean().totalSupply());

        // Operator position is unimportant, verify no held Beans.
        assertEq(C.bean().balanceOf(OPERATOR), 0);
    }

    function test_depositAllBeans() public {
        uint256 tip = 10e6;

        // Move publisher Beans to internal balance.
        uint256 beanBalance = bean.balanceOf(PUBLISHER);
        vm.prank(PUBLISHER);
        // tokenFacet.approveToken(BEANSTALK, bean, beanBalance);
        bean.approve(BEANSTALK, beanBalance);
        vm.prank(PUBLISHER);
        beanstalk.transferToken(
            bean,
            PUBLISHER,
            beanBalance,
            LibTransfer.From.EXTERNAL,
            LibTransfer.To.INTERNAL
        );
        assertEq(
            tokenFacet.getInternalBalance(PUBLISHER, bean),
            beanBalance,
            "Internal balance init failure"
        );

        // User creates a Requisition containing a blueprint with instructions to Enroot.
        LibTractor.Requisition memory requisition;
        (bytes memory data, bytes32[] memory operatorPasteInstrs) = LibDrafter.draftDepositAllBeans(
            tip
        );
        requisition.blueprint = LibTractor.Blueprint({
            publisher: PUBLISHER,
            data: data,
            operatorPasteInstrs: operatorPasteInstrs,
            maxNonce: 100,
            startTime: 0,
            endTime: type(uint256).max
        });

        requisition.blueprintHash = tractorFacet.getBlueprintHash(requisition.blueprint);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PUBLISHER_PRIVATE_KEY, requisition.blueprintHash);
        requisition.signature = abi.encodePacked(r, s, v);

        // No operator calldata used.
        bytes memory operatorData;

        // Operator executes the Blueprint, enrooting the user.
        vm.prank(OPERATOR);
        tractorFacet.tractor(requisition, operatorData);

        // Verify state of User and Operator.
        assertEq(bean.balanceOf(OPERATOR), tip);
        assertEq(bean.balanceOf(PUBLISHER), uint256(0));
        // check logs, get deposit ID, verify internal balance.
        // vm.assertEq(BEANSTALK.INTERNALBALANCE(PUBLISHER), xxx);
    }

    /*
    ** NOTE this test does not work well bc it requires the private key of an account holding enrootable deposits.
    ** This could probably be cleverly built using foundry vm cheatcodes, but would be very difficult and not worth atm.
    function test_tractorEnroot() public {
        // User creates a Requisition containing a blueprint with instructions to Enroot.
        LibTractor.Requisition memory requisition;
        (bytes memory data, bytes memory operatorPasteInstrs) = LibDrafter.draftEnrootDeposits();
        requisition.blueprint = LibTractor.Blueprint({
            publisher: PUBLISHER,
            data: data,
            operatorPasteInstrs: operatorPasteInstrs,
            maxNonce: 100,
            startTime: 0,
            endTime: type(uint256).max
        });

        requisition.blueprintHash = tractorFacet.getBlueprintHash(requisition.blueprint);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PUBLISHER_PRIVATE_KEY, requisition.blueprintHash);
        requisition.signature = abi.encodePacked(r, s, v);

        console.log("Publisher: %s", PUBLISHER);

        console.log("hash: ");
        console.logBytes32(requisition.blueprintHash);
        console.log("signature: ");
        console.logBytes(requisition.signature);

        // Operator determined data.
        // OperatorData expected shape:
        // 0-119: int96[] - urBean stems
        // 120-439: uint256[] - urBean amounts
        // 440-559: int96[] - urLP stems
        // 560-879: uint256[] - urLP amounts
        int96[] memory urBeanSteams = new int96[](ARRAY_LENGTH);
        uint256[] memory urBeanAmounts = new uint256[](ARRAY_LENGTH);
        int96[] memory urLPSteams = new int96[](ARRAY_LENGTH);
        uint256[] memory urLPAmounts = new uint256[](ARRAY_LENGTH);
        bytes memory operatorData;
        operatorData = abi.encodePacked(urBeanSteams, urBeanAmounts, urLPSteams, urLPAmounts);

        // Operator executes the Blueprint, enrooting the user.
        vm.prank(OPERATOR);
        tractorFacet.tractor(requisition, operatorData);
    }

    // function test_tractorMow() public {}

    // function test_tractorPlant() public {}

    // function test_tractorRinseAndDeposit() public {}

    // function test_tractorHarvestAndDeposit() public {}

*/
}
