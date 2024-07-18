// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ///////// DEPRECATED IN FAVOR OF JS TESTS /////////

// import "forge-std/Test.sol";

// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// import {C} from "contracts/C.sol";
// import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
// import {LibTractor} from "contracts/libraries/LibTractor.sol";
// import {IBeanstalk} from "contracts/interfaces/IBeanstalk.sol";
// import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
// import {TokenFacet} from "contracts/beanstalk/farm/TokenFacet.sol";
// import {TractorFacet} from "contracts/beanstalk/farm/TractorFacet.sol";
// import {JunctionFacet} from "contracts/beanstalk/junction/JunctionFacet.sol";
// import {TestHelper} from "test/foundry/utils/TestHelper.sol";
// import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
// import {LibClipboard} from "./LibClipboard.sol";
// import {AdvancedFarmCall} from "./LibFarm.sol";
// import {LibBytes} from "./LibBytes.sol";
// import {LibOperatorPasteInstr} from "./LibOperatorPasteInstr.sol";
// import {LibReturnPasteParam} from "./LibReturnPasteParam.sol";

// This is the default size of arrays containing stems/deposits. Operators can populate the array up to the size.
uint80 constant ARRAY_LENGTH = 5;

// NOTE: These tests are deprecated in favor of JS tests. They are kept here for reference only.
//       They do not compile and are not necessarily correct.
//       Testing tractor in Solidity is undesirable due to the difficulty of managing arrays and bytes in Solidity.

// contract TractorTest is TestHelper {
//     uint256 private constant PUBLISHER_PRIVATE_KEY = 123456789;

//     address private PUBLISHER;
//     address private constant OPERATOR = address(982340983475);

//     address private constant BEANSTALK = address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);
//     address private constant BEANSTALK_OWNER = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

//     IBeanstalk beanstalk;
//     IERC20 bean;

//     TractorFacet tractorFacet;
//     JunctionFacet junctionFacet;
//     TokenFacet tokenFacet;

//     function setUp() public {
//         vm.createSelectFork({urlOrAlias: "mainnet", blockNumber: 18_686_631});

//         beanstalk = IBeanstalk(BEANSTALK);
//         bean = IERC20(C.BEAN);
//         tokenFacet = TokenFacet(BEANSTALK);

//         PUBLISHER = vm.addr(PUBLISHER_PRIVATE_KEY);

//         // Cut and init TractorFacet.
//         IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
//         cut[0] = _cut("TractorFacet", address(new TractorFacet()));
//         vm.prank(BEANSTALK_OWNER); // LibAppStorage.diamondStorage().sys.contractOwner
//         IDiamondCut(BEANSTALK).diamondCut(
//             cut,
//             address(0), // address of contract with init() function
//             abi.encodeWithSignature("init()")
//         );
//         tractorFacet = TractorFacet(BEANSTALK);

//         // Cut and init JunctionFacet.
//         cut = new IDiamondCut.FacetCut[](1);
//         cut[0] = _cut("JunctionFacet", address(new JunctionFacet()));
//         vm.prank(BEANSTALK_OWNER); // LibAppStorage.diamondStorage().sys.contractOwner
//         IDiamondCut(BEANSTALK).diamondCut(
//             cut,
//             address(0), // address of contract with init() function
//             ""
//         );
//         junctionFacet = JunctionFacet(BEANSTALK);

//         // Mint beans
//         // vm.prank(0x62d69f6867A0A084C6d313943dC22023Bc263691);
//         deal(C.BEAN, PUBLISHER, 5000e6);
//         console.log("Bean supply is", C.bean().totalSupply());

//         // Operator position is unimportant, verify no held Beans.
//         assertEq(C.bean().balanceOf(OPERATOR), 0);
//     }

//     function test_depositAllBeans() public {
//         uint256 tip = 10e6;

//         // Move publisher Beans to internal balance.
//         uint256 beanBalance = bean.balanceOf(PUBLISHER);
//         vm.prank(PUBLISHER);
//         // tokenFacet.approveToken(BEANSTALK, bean, beanBalance);
//         bean.approve(BEANSTALK, beanBalance);
//         vm.prank(PUBLISHER);
//         beanstalk.transferToken(
//             bean,
//             PUBLISHER,
//             beanBalance,
//             LibTransfer.From.EXTERNAL,
//             LibTransfer.To.INTERNAL
//         );
//         assertEq(
//             tokenFacet.getInternalBalance(PUBLISHER, bean),
//             beanBalance,
//             "Internal balance init failure"
//         );

//         // User creates a Requisition containing a blueprint with instructions to Enroot.
//         LibTractor.Requisition memory requisition;
//         (bytes memory data, bytes32[] memory operatorPasteInstrs) = LibDrafter.draftDepositAllBeans(
//             tip
//         );
//         requisition.blueprint = LibTractor.Blueprint({
//             publisher: PUBLISHER,
//             data: data,
//             operatorPasteInstrs: operatorPasteInstrs,
//             maxNonce: 100,
//             startTime: 0,
//             endTime: type(uint256).max
//         });

//         requisition.blueprintHash = tractorFacet.getBlueprintHash(requisition.blueprint);
//         (uint8 v, bytes32 r, bytes32 s) = vm.sign(PUBLISHER_PRIVATE_KEY, requisition.blueprintHash);
//         requisition.signature = abi.encodePacked(r, s, v);

//         // No operator calldata used.
//         bytes memory operatorData;

//         // Operator executes the Blueprint, enrooting the user.
//         vm.prank(OPERATOR);
//         tractorFacet.tractor(requisition, operatorData);

//         // Verify state of User and Operator.
//         assertEq(bean.balanceOf(OPERATOR), tip);
//         assertEq(bean.balanceOf(PUBLISHER), uint256(0));
//         // check logs, get deposit ID, verify internal balance.
//         // vm.assertEq(BEANSTALK.INTERNALBALANCE(PUBLISHER), xxx);
//     }
// }

// // NOTE how to encode dynamically sized data? Not possible, without either:
// //    1. Telling the contract how to extract data (i.e. unique functions for each call type)
// //    2. Using a fixed size data structure (i.e. uint256[10] instead of uint256[]) with all possible types (ew)
// //    3. Manually composing the data? by pasting the location, length, and then each item individually.....
// //          - This is not possible bc the size of the data is not known ahead of time, therefore the location
// //            of the data is not known ahead of time. So the blueprint copyData cannot be configured in a
// //            generalized way.

// /**
//  * @title Lib Drafter
//  * @author funderbrker
//  * @notice Standard library for generating common blueprints in a standard configuration.
//  * @dev Not gas optimized for on-chain usage. These functions are intended to be standardized client helpers.
//  **/
// library LibDrafter {
//     using LibBytes for bytes;

//     /**
//      * @notice  Draft a set of instructions enabling the operator to auto deposit all Beans from publisher internal bal.
//      * @dev     When computing paste instr indices make sure to account for the leading length data in a bytes object.
//      * @param   tip  amount to pay operator, in Beans, from internal balance.
//      * @return  data containing instructions.
//      * @return  operatorPasteInstrs containing copy instructions for the data. Defines shape of operatorData.
//      * OperatorData expected shape:
//      * EMPTY
//      */
//     function draftDepositAllBeans(
//         uint256 tip
//     ) external view returns (bytes memory data, bytes32[] memory operatorPasteInstrs) {
//         // Use contract and interface objects to extract selectors.
//         IBeanstalk beanstalk;
//         TokenFacet tokenFacet;
//         JunctionFacet junctionFacet;

//         uint256 operatorPasteInstrsLength;

//         // Preset the operatorPasteInstrs size because Solidity.
//         operatorPasteInstrs = new bytes32[](2);

//         // Advanced Farm calls, composed of calldata and return paste params (clipboard).
//         AdvancedFarmCall[] memory advancedFarmCalls = new AdvancedFarmCall[](4);

//         ////// bean.balanceOf(publisher) - returnData[0] //////
//         advancedFarmCalls[0] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 tokenFacet.getInternalBalance.selector,
//                 address(0),
//                 C.BEAN
//             ),
//             clipboard: abi.encodePacked(bytes2(0))
//         });
//         operatorPasteInstrs[operatorPasteInstrsLength] = LibOperatorPasteInstr.encode(
//             C.PUBLISHER_COPY_INDEX,
//             0,
//             C.ARGS_START_INDEX + C.ADDR_SLOT_OFFSET
//         );
//         operatorPasteInstrsLength += 1;

//         ////// MathJunction.sub(internalBalance, tip) - returnData[1] //////
//         advancedFarmCalls[1] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(junctionFacet.sub.selector, uint256(0), tip),
//             clipboard: LibClipboard.encode(
//                 LibReturnPasteParam.encode(
//                     0,
//                     C.SLOT_SIZE, // copy after length data
//                     C.ARGS_START_INDEX
//                 )
//             )
//         });

//         ////// deposit(token, _amount, mode) - returnData[2] //////
//         advancedFarmCalls[2] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 beanstalk.deposit.selector,
//                 C.BEAN,
//                 uint256(0),
//                 LibTransfer.From.INTERNAL
//             ),
//             clipboard: LibClipboard.encode(
//                 LibReturnPasteParam.encode(
//                     1,
//                     C.SLOT_SIZE, // copy after length data
//                     C.ARGS_START_INDEX + C.SLOT_SIZE
//                 )
//             )
//         });

//         ////// beanstalk.transfer - returnData[3] //////
//         advancedFarmCalls[3] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 beanstalk.transferToken.selector,
//                 C.BEAN,
//                 address(0),
//                 tip,
//                 LibTransfer.From.INTERNAL,
//                 LibTransfer.To.EXTERNAL
//             ),
//             clipboard: abi.encodePacked(bytes2(0))
//         });
//         operatorPasteInstrs[operatorPasteInstrsLength] = LibOperatorPasteInstr.encode(
//             C.OPERATOR_COPY_INDEX,
//             3,
//             C.ARGS_START_INDEX + C.SLOT_SIZE + C.ADDR_SLOT_OFFSET
//         ); // + ADDR_SIZE)
//         operatorPasteInstrsLength += 1;

//         bytes memory callData = abi.encodeWithSelector(
//             beanstalk.advancedFarm.selector,
//             advancedFarmCalls
//         );
//         data = abi.encodePacked(
//             bytes1(0), // type
//             callData
//         );
//         console.logBytes(callData);
//         console.log("adv farm calls:");
//         console.logBytes(abi.encode(advancedFarmCalls));
//         console.log("operatorPasteInstrs:");
//         console.logBytes(abi.encode(operatorPasteInstrs));
//     }

//     // NOTE testing Enroot is very difficult without the private key of someone already holding enrootable deposits.
//     /// @notice generate a standard blueprint for enrooting deposits. Token, stems, and amounts are set by publisher
//     ///         at blueprint creation time. Operator is paid in beans proportional to the total increase in stalk.
//     // OperatorData expected shape:
//     // 0-119: int96[] - urBean stems
//     // 120-439: uint256[] - urBean amounts
//     // 440-559: int96[] - urLP stems
//     // 560-879: uint256[] - urLP amounts
//     function draftEnrootDeposits()
//         external
//         view
//         returns (bytes memory data, bytes32[] memory operatorPasteInstrs)
//     {
//         // Use contract and interface objects to extract selectors.
//         IBeanstalk beanstalk;
//         JunctionFacet junctionFacet;
//         // Junctions have to be a facet because they need externally callable selectors.
//         // LibMathJunction mathJunction = LibMathJunction();

//         uint80 operatorDataLength;
//         uint256 operatorPasteInstrsLength;

//         // Preset the shape of stems and amount. Operator can populate the values.
//         int96[] memory stems = new int96[](ARRAY_LENGTH);
//         uint256[] memory amounts = new uint256[](ARRAY_LENGTH);

//         // Preset the operatorPasteInstrs size because Solidity.
//         operatorPasteInstrs = new bytes32[](7);

//         // Advanced Farm calls, composed of calldata and return paste params (clipboard).
//         AdvancedFarmCall[] memory advancedFarmCalls = new AdvancedFarmCall[](7);

//         ////// getStalk(publisher) - returnData[0] //////
//         advancedFarmCalls[0] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(beanstalk.balanceOfStalk.selector, address(0)),
//             clipboard: abi.encodePacked(bytes2(0))
//         });
//         operatorPasteInstrs[0] = LibOperatorPasteInstr.encode(
//             C.PUBLISHER_COPY_INDEX,
//             0,
//             C.ARGS_START_INDEX
//         );
//         operatorPasteInstrsLength += 1;

//         ////// EnrootDeposits(UNRIPE_BEAN, stems, amounts) - returnData[1] //////
//         advancedFarmCalls[1] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 beanstalk.enrootDeposits.selector,
//                 C.UNRIPE_BEAN,
//                 stems,
//                 amounts
//             ),
//             clipboard: abi.encodePacked(bytes2(0))
//         });
//         mergeOperatorPasteInstrs(
//             operatorPasteInstrs,
//             operatorPasteInstrsLength,
//             LibOperatorPasteInstr.generate(
//                 ARRAY_LENGTH,
//                 0,
//                 1,
//                 // Read the location of the stems array from the calldata.
//                 advancedFarmCalls[1].callData.toUint80(C.ARGS_START_INDEX + C.SLOT_SIZE)
//             )
//         );
//         operatorDataLength += ARRAY_LENGTH * C.SLOT_SIZE;
//         operatorPasteInstrsLength += ARRAY_LENGTH;
//         mergeOperatorPasteInstrs(
//             operatorPasteInstrs,
//             operatorPasteInstrsLength,
//             LibOperatorPasteInstr.generate(
//                 ARRAY_LENGTH,
//                 operatorDataLength,
//                 1,
//                 // Read the location of the amounts array from the calldata.
//                 advancedFarmCalls[1].callData.toUint80(C.ARGS_START_INDEX + C.SLOT_SIZE * 2)
//             )
//         );
//         operatorDataLength += ARRAY_LENGTH * C.SLOT_SIZE;
//         operatorPasteInstrsLength += ARRAY_LENGTH;

//         ////// EnrootDeposits(UNRIPE_LP, stems, amounts) - returnData[1] //////
//         advancedFarmCalls[2] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 beanstalk.enrootDeposits.selector,
//                 C.UNRIPE_LP,
//                 stems,
//                 amounts
//             ),
//             clipboard: abi.encodePacked(bytes2(0))
//         });
//         mergeOperatorPasteInstrs(
//             operatorPasteInstrs,
//             operatorPasteInstrsLength,
//             LibOperatorPasteInstr.generate(
//                 ARRAY_LENGTH,
//                 operatorDataLength,
//                 1,
//                 // Read the location of the stems array from the calldata.
//                 advancedFarmCalls[2].callData.toUint80(C.ARGS_START_INDEX + C.SLOT_SIZE)
//             )
//         );
//         operatorDataLength += ARRAY_LENGTH * C.SLOT_SIZE;
//         operatorPasteInstrsLength += ARRAY_LENGTH;
//         mergeOperatorPasteInstrs(
//             operatorPasteInstrs,
//             operatorPasteInstrsLength,
//             LibOperatorPasteInstr.generate(
//                 ARRAY_LENGTH,
//                 operatorDataLength,
//                 1,
//                 // Read the location of the amounts array from the calldata.
//                 advancedFarmCalls[2].callData.toUint80(C.ARGS_START_INDEX + C.SLOT_SIZE * 2)
//             )
//         );
//         operatorDataLength += ARRAY_LENGTH * C.SLOT_SIZE;
//         operatorPasteInstrsLength += ARRAY_LENGTH;

//         ////// getStalk(publisher) - returnData[3] //////
//         advancedFarmCalls[3] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(beanstalk.balanceOfStalk.selector, address(0)),
//             clipboard: abi.encodePacked(bytes2(0))
//         });
//         operatorPasteInstrs[operatorPasteInstrsLength] = LibOperatorPasteInstr.encode(
//             C.PUBLISHER_COPY_INDEX,
//             3,
//             C.ARGS_START_INDEX
//         );
//         operatorPasteInstrsLength += 1;

//         ///// junctions.Sub - returnData[4] //////
//         bytes32[] memory returnPasteParams = new bytes32[](2);
//         returnPasteParams[0] = LibReturnPasteParam.encode(3, 0, C.ARGS_START_INDEX);
//         returnPasteParams[1] = LibReturnPasteParam.encode(0, 0, C.ARGS_START_INDEX + C.SLOT_SIZE);
//         advancedFarmCalls[4] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(junctionFacet.sub.selector, uint256(0), uint256(0)),
//             clipboard: LibClipboard.encode(0, returnPasteParams)
//         });

//         ////// junctions.MulDiv(amount, rewardRatio, precision) - returnData[5] //////
//         advancedFarmCalls[5] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 junctionFacet.mulDiv.selector,
//                 uint256(0),
//                 C.PRECISION / 10000, // 0.01% of stalk
//                 C.PRECISION
//             ),
//             clipboard: LibClipboard.encode(LibReturnPasteParam.encode(4, 0, C.ARGS_START_INDEX))
//         });

//         ////// beanstalk.transfer - returnData[6] //////
//         advancedFarmCalls[6] = AdvancedFarmCall({
//             callData: abi.encodeWithSelector(
//                 beanstalk.transferToken.selector,
//                 C.BEAN,
//                 address(0),
//                 uint256(0),
//                 LibTransfer.From.INTERNAL,
//                 LibTransfer.To.EXTERNAL
//             ),
//             clipboard: LibClipboard.encode(
//                 LibReturnPasteParam.encode(
//                     5,
//                     0,
//                     C.ARGS_START_INDEX + C.SLOT_SIZE + C.SLOT_SIZE // + ADDR_SIZE + ADDR_SIZE
//                 )
//             )
//         });
//         operatorPasteInstrs[operatorPasteInstrsLength] = LibOperatorPasteInstr.encode(
//             C.OPERATOR_COPY_INDEX,
//             6,
//             C.ARGS_START_INDEX + C.SLOT_SIZE
//         ); // + ADDR_SIZE)
//         operatorPasteInstrsLength += 1;

//         bytes memory callData = abi.encodeWithSelector(
//             beanstalk.advancedFarm.selector,
//             advancedFarmCalls
//         );
//         data = abi.encodePacked(
//             bytes1(0), // type
//             callData
//         );
//         console.logBytes(callData);
//         console.log("adv farm call:");
//         console.logBytes(abi.encode(advancedFarmCalls[0]));
//         console.log("adv farm calls:");
//         console.logBytes(abi.encode(advancedFarmCalls));
//     }

//     // NOTE pass by reference?
//     function mergeOperatorPasteInstrs(
//         bytes32[] memory operatorPasteInstrs,
//         uint256 startIdx,
//         bytes32[] memory toInject
//     ) private pure {
//         for (uint256 i; i < toInject.length; ++i) {
//             operatorPasteInstrs[startIdx + i] = toInject[i];
//         }
//     }
// }
