/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// TODO rm
import "forge-std/console.sol";

import {JunctionFacet} from "../beanstalk/junction/JunctionFacet.sol";
import {IBeanstalk} from "../interfaces/IBeanstalk.sol";
import {LibClipboard} from "./LibClipboard.sol";
import {AdvancedFarmCall} from "./LibFarm.sol";
import {LibBytes} from "./LibBytes.sol";
import {LibTransfer} from "./Token/LibTransfer.sol";
import {C} from "../C.sol";

// Functional
// Cant use any operations here, only functions and direct data

// abi.encodeWithSelector(bytes4 selector, ...) returns (bytes memory)
// use this to generate function call data. this is equivalent to
// bytes memory data = bytes.append(bytes4(selector), abi.encode(...));
// selector can be retrieved by
// aContract.someFunction.selector

// can only make ONE call to advancedFarmCall bc the local return data is cached and used internally

// each sub function needs its own unique clipboard config

// TODO how to encode dynamically sized data? Not possible, without either:
//    1. Telling the contract how to extract data (i.e. unique functions for each call type)
//    2. Using a fixed size data structure (i.e. uint256[10] instead of uint256[]) with all possible types (ew)
//    3. Manually composing the data? by pasting the location, length, and then each item individually.....
//          - This is not possible bc the size of the data is not known ahead of time, therefore the location
//            of the data is not known ahead of time. So the blueprint copyData cannot be configured in a
//            generalized way.

// This is the default size of arrays containing stems/deposits. Operators can populate the array up to the size.
uint80 constant ARRAY_LENGTH = 10;

uint80 constant PUBLISHER_COPY_INDEX = type(uint80).max;
uint80 constant OPERATOR_COPY_INDEX = type(uint80).max - 1;

uint80 constant SLOT_SIZE = 32;
uint80 constant ADDR_SIZE = 20;
uint80 constant TARGET_SIZE = 20;
uint80 constant SELECTOR_SIZE = 4;
uint80 constant ARGS_START_INDEX = TARGET_SIZE + SELECTOR_SIZE;

/**
 * @title Lib Drafter
 * @author funderbrker
 * @notice Standard library for generating common blueprints in a standard configuration.
 * @dev Not gas optimized for on-chain usage. These functions are intended to be standardized client helpers.
 **/
library LibDrafter {
    using LibBytes for bytes;

    struct operatorPasteStruct {
        uint80 copyByteIndex;
        uint80 pasteCallIndex;
        uint80 pasteByteIndex;
    }

    function encodeOperatorPasteParams(
        uint80 copyByteIndex,
        uint80 pasteCallIndex,
        uint80 pasteByteIndex
    ) private pure returns (bytes32) {
        return abi.encodePacked(copyByteIndex, pasteCallIndex, pasteByteIndex).toBytes32(0);
    }

    // function encodeOperatorPasteParams(
    //     operatorPasteStruct memory operatorPasteStruct
    // ) private pure returns (bytes memory) {
    //     return abi.encodePacked(operatorPasteStruct.copyByteIndex, operatorPasteStruct.pasteCallIndex, operatorPasteStruct.pasteByteIndex);
    // }

    function generateOperatorPasteParams(
        uint256 length,
        uint80 copyStartByteIndex,
        uint80 pasteCallIndex,
        uint80 pasteStartByteIndex
    ) private pure returns (bytes memory) {
        bytes memory operatorPasteParams;
        for (uint80 i = 0; i < length; i++) {
            // operatorPasteStructs[i] = operatorPasteStruct({
            //     copyByteIndex: copyStartByteIndex + SLOT_SIZE * i,
            //     pasteCallIndex: pasteCallIndex,
            //     pasteByteIndex: pasteStartByteIndex + SLOT_SIZE * i
            // });
            operatorPasteParams = operatorPasteParams.append(
                encodeOperatorPasteParams(
                    copyStartByteIndex + SLOT_SIZE * i, // copyByteIndex
                    pasteCallIndex, // pasteCallIndex
                    pasteStartByteIndex + SLOT_SIZE * i // pasteByteIndex
                )
            );
        }
        return operatorPasteParams;
    }

    // NOTE OperaterCallData is encoded lazily, with each object taking a 32 bytes slot.

    // OperatorCallData shape:
    // 0-319: urBean stems
    // 320-639: urBean amounts
    // 640-959: urLP stems
    // 960-1280: urLP amounts
    //

    /// @notice generate a standard blueprint for enrooting deposits. Token, stems, and amounts are set by publisher
    ///         at blueprint creation time. Operator is paid in beans proportional to the total increase in stalk.
    function draftEnrootDeposits()
        external
        pure
        returns (bytes memory data, bytes memory operatorPasteParams)
    {
        // Use contract and interface objects to extract selectors.
        IBeanstalk beanstalk;
        JunctionFacet junctionFacet;
        // Junctions have to be a facet because they need externally callable selectors.
        // LibMathJunction mathJunction = LibMathJunction();

        uint80 operatorCallDataLength;
        // Preset the shape of stems and amount. Operator can populate the values.
        int96[] memory stems = new int96[](ARRAY_LENGTH);
        uint256[] memory amounts = new uint256[](ARRAY_LENGTH);

        // // One array of operatorPasteStruct for the entire blueprint.
        // operatorPasteStruct[] memory operatorPasteStructs = new operatorPasteStruct[](3);

        // Advanced Farm calls, composed of calldata and return paste params (clipboard).
        AdvancedFarmCall[] memory advancedFarmCalls = new AdvancedFarmCall[](6);

        ////// getStalk(publisher) - returnData[0] //////
        advancedFarmCalls[0] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.balanceOfStalk.selector, address(0)),
            clipboard: bytes("0x00")
        });
        operatorPasteParams = operatorPasteParams.append(
            encodeOperatorPasteParams(PUBLISHER_COPY_INDEX, 0, ARGS_START_INDEX)
        );
        // operatorPasteStructs[0] = operatorPasteStruct({
        //     copyByteIndex: PUBLISHER_COPY_INDEX,
        //     pasteCallIndex: 0,
        //     pasteByteIndex: ARGS_START_INDEX
        // });

        ////// EnrootDeposits(UNRIPE_BEAN, stems, amounts) - returnData[1] //////
        advancedFarmCalls[1] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                beanstalk.enrootDeposits.selector,
                C.UNRIPE_BEAN,
                stems,
                amounts
            ),
            clipboard: bytes("0x00")
        });
        operatorPasteParams = abi.encode(
            operatorPasteParams,
            generateOperatorPasteParams(
                ARRAY_LENGTH,
                SLOT_SIZE * 0,
                1,
                // Read the location of the stems array from the calldata.
                advancedFarmCalls[1].callData.toUint80(ARGS_START_INDEX + SLOT_SIZE)
            )
        );
        operatorCallDataLength += ARRAY_LENGTH * SLOT_SIZE;
        operatorPasteParams = abi.encode(
            operatorPasteParams,
            generateOperatorPasteParams(
                ARRAY_LENGTH,
                operatorCallDataLength,
                1,
                // Read the location of the amounts array from the calldata.
                advancedFarmCalls[1].callData.toUint80(ARGS_START_INDEX + SLOT_SIZE * 2)
            )
        );
        operatorCallDataLength += ARRAY_LENGTH * SLOT_SIZE;

        ////// EnrootDeposits(UNRIPE_LP, stems, amounts) - returnData[1] //////
        advancedFarmCalls[2] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                beanstalk.enrootDeposits.selector,
                C.UNRIPE_LP,
                stems,
                amounts
            ),
            clipboard: bytes("0x00")
        });
        operatorPasteParams = abi.encode(
            operatorPasteParams,
            generateOperatorPasteParams(
                ARRAY_LENGTH,
                operatorCallDataLength,
                1,
                // Read the location of the stems array from the calldata.
                advancedFarmCalls[2].callData.toUint80(ARGS_START_INDEX + SLOT_SIZE)
            )
        );
        operatorCallDataLength += ARRAY_LENGTH * SLOT_SIZE;
        operatorPasteParams = abi.encode(
            operatorPasteParams,
            generateOperatorPasteParams(
                ARRAY_LENGTH,
                operatorCallDataLength,
                1,
                // Read the location of the amounts array from the calldata.
                advancedFarmCalls[2].callData.toUint80(ARGS_START_INDEX + SLOT_SIZE * 2)
            )
        );
        operatorCallDataLength += ARRAY_LENGTH * SLOT_SIZE;

        ////// getStalk(publisher) - returnData[3] //////
        advancedFarmCalls[3] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.balanceOfStalk.selector, address(0)),
            clipboard: bytes("0x00")
        });
        operatorPasteParams = operatorPasteParams.append(
            encodeOperatorPasteParams(PUBLISHER_COPY_INDEX, 3, ARGS_START_INDEX)
        );

        ///// junctions.Sub - returnData[4] //////
        LibClipboard.ReturnPasteParams[]
            memory returnPasteParams = new LibClipboard.ReturnPasteParams[](2);
        returnPasteParams[0] = LibClipboard.ReturnPasteParams({
            returnDataItemIndex: 3,
            copyByteIndex: 0,
            pasteByteIndex: ARGS_START_INDEX
        });
        returnPasteParams[1] = LibClipboard.ReturnPasteParams({
            returnDataItemIndex: 0,
            copyByteIndex: 0,
            pasteByteIndex: ARGS_START_INDEX + SLOT_SIZE
        });
        advancedFarmCalls[4] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(junctionFacet.sub.selector, uint256(0), uint256(0)),
            clipboard: LibClipboard.encodeClipboard(0, returnPasteParams)
        });

        ////// junctions.MulDiv(amount, rewardRatio, precision) - returnData[5] //////
        advancedFarmCalls[5] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                junctionFacet.mulDiv.selector,
                uint256(0),
                C.PRECISION / 10000, // 0.01% of stalk
                C.PRECISION
            ),
            clipboard: LibClipboard.encodeClipboard(
                LibClipboard.ReturnPasteParams({
                    returnDataItemIndex: 4,
                    copyByteIndex: 0,
                    pasteByteIndex: ARGS_START_INDEX
                })
            )
        });

        ////// beanstalk.transfer - returnData[6] //////
        advancedFarmCalls[6] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                beanstalk.transferToken.selector,
                C.BEAN,
                address(0),
                uint256(0),
                LibTransfer.From.INTERNAL,
                LibTransfer.To.EXTERNAL
            ),
            clipboard: LibClipboard.encodeClipboard(
                LibClipboard.ReturnPasteParams({
                    returnDataItemIndex: 5,
                    copyByteIndex: 0,
                    pasteByteIndex: ARGS_START_INDEX + ADDR_SIZE + ADDR_SIZE
                })
            )
        });
        operatorPasteParams = operatorPasteParams.append(
            encodeOperatorPasteParams(PUBLISHER_COPY_INDEX, 6, ARGS_START_INDEX + ADDR_SIZE)
        );

        data = abi.encodePacked(
            bytes("0x00"), // type
            abi.encodeWithSelector(beanstalk.advancedFarm.selector, advancedFarmCalls)
        );
    }

    /*
    /// @notice Generate a standard blueprint that allows the operator to Mow any deposit. Operator is paid in Beans,
    ///         proportional to Stalk increase.
    function draftMow() {
        // One array of operatorPasteStructs for the entire blueprint.
        operatorPasteStruct[] memory operatorPasteStructs = new operatorPasteStruct[](5);

        // Advanced Farm calls, composed of calldata and return paste params (clipboard).
        AdvancedFarmCalls[] memory advancedFarmCalls = new AdvancedFarmCalls[](6);

        ////// getStalk(publisher) - returnData[0] //////
        operatorPasteStructs[0] = operatorPasteStruct({
            copyByteIndex: 0,
            pasteCallIndex: 0,
            pasteByteIndex: 24
        });
        advancedFarmCalls[0] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.balanceOfStalk.selector, address(0)),
            clipboard: bytes("0x00")
        });

        ////// Mow(account, token) - returnData[1] //////
        operatorPasteStructs[1] = operatorPasteStruct({
            copyByteIndex: OPERATOR_COPY_INDEX,
            pasteCallIndex: 1,
            pasteByteIndex: 24
        });
        operatorPasteStructs[2] = operatorPasteStruct({
            copyByteIndex: 0,
            pasteCallIndex: 1,
            pasteByteIndex: 24 + 20
        });
        advancedFarmCalls[1] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.Mow.selector, address(0), address(0)),
            clipboard: bytes("0x00")
        });

        ////// getStalk(publisher) - returnData[2] //////
        operatorPasteStructs[3] = operatorPasteStruct({
            copyByteIndex: PUBLISHER_COPY_INDEX,
            pasteCallIndex: 2,
            pasteByteIndex: 24
        });
        advancedFarmCalls[2] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.balanceOfStalk.selector, address(0)),
            clipboard: bytes("0x00")
        });

        ///// junctions.Sub - returnData[3] //////
        ReturnPasteParams[] memory returnPasteParams = new ReturnPasteParams[](2);
        returnPasteParams[0] = ReturnPasteParams({
            returnDataItemIndex: 2,
            copyByteIndex: 0,
            pasteByteIndex: 24
        });
        returnPasteParams[1] = ReturnPasteParams({
            returnDataItemIndex: 0,
            copyByteIndex: 0,
            pasteByteIndex: 24 + 32
        });
        advancedFarmCalls[3] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(junctions.Sub.selector, uint256(0), uint256(0)),
            clipboard: LibClipboard.encodeClipboard(0, returnPasteParams)
        });

        ////// junctions.MulDiv(amount, rewardRatio, precision) - returnData[4] //////
        advancedFarmCalls[4] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                junctions.MulDiv.selector,
                uint256(0),
                C.PRECISION / 10000, // 0.01% of stalk
                C.PRECISION
            ),
            clipboard: LibClipboard.encodeClipboard(
                ReturnPasteParams({
                    returnDataItemIndex: 3,
                    copyByteIndex: 0,
                    pasteByteIndex: 24 + 32
                })
            )
        });

        ////// beanstalk.transfer - returnData[5] //////
        operatorPasteStructs[4] = operatorPasteStruct({
            copyByteIndex: OPERATOR_COPY_INDEX,
            pasteCallIndex: 5,
            pasteByteIndex: 24 + 20
        });
        advancedFarmCalls[5] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                beanstalk.transferToken.selector,
                C.BEAN,
                address(0),
                uint256(0),
                LibTransfer.From.INTERNAL,
                LibTransfer.To.EXTERNAL
            ),
            clipboard: LibClipboard.encodeClipboard(
                ReturnPasteParams({
                    returnDataItemIndex: 4,
                    copyByteIndex: 0,
                    pasteByteIndex: 24 + 20 + 20
                })
            )
        });

        data = abi.encodeWithSelector(beanstalk.advancedFarm.selector, advancedFarmCalls);
        // TODO - doubt this encodes the way it needs to
        operatorPasteParams = abi.encode(operatorPasteStructs);
    }
    */
}
