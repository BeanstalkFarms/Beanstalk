/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {LibClipboard} from "./LibClipboard.sol";

// Functional
// Cant use any operations here, only functions and direct data

// abi.encodeWithSelector(bytes4 selector, ...) returns (bytes memory)
// use this to generate function call data. this is equivalent to
// bytes memory data = bytes.concat(bytes4(selector), abi.encode(...));
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

bytes10 constant PUBLISHER_COPY_INDEX = type(uint80).max;
bytes10 constant OPERATOR_COPY_INDEX = type(uint80).max - 1;

/**
 * @title Lib Drafter
 * @notice Library for generating common blueprints
 * @author funderberker
 **/
library LibDrafter {
    /// @notice generate a standard blueprint for enrooting deposits. Token, stems, and amounts are set by publisher
    ///         at blueprint creation time. Operator is paid in beans proportional to the total increase in stalk.
    function draftEnrootDeposits(
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) internal view returns (bytes memory data, bytes memory operatorPasteParams) {
        // One array of OperatorPasteParams for the entire blueprint.
        OperatorPasteParams[] memory operatorPasteParams = new OperatorPasteParams[](3);

        // Advanced Farm calls, composed of calldata and return paste params (clipboard).
        AdvancedFarmCalls[] memory advancedFarmCalls = new AdvancedFarmCalls[](6);

        ////// getStalk(publisher) - returnData[0] //////
        operatorPasteParams[0] = OperatorPasteParams({
            copyByteIndex: 0,
            pasteCallIndex: 0,
            pasteByteIndex: 24
        });
        advancedFarmCalls[0] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.getStalk.selector, address(0)),
            clipboard: 0x00
        });

        ////// EnrootDeposits(token, stems, amounts) - returnData[1] //////
        advancedFarmCalls[1] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(
                beanstalk.EnrootDeposits.selector,
                C.BEAN,
                stems,
                amounts
            ),
            clipboard: 0x00
        });

        ////// getStalk(publisher) - returnData[2] //////
        operatorPasteParams[1] = OperatorPasteParams({
            copyByteIndex: 0,
            pasteCallIndex: 2,
            pasteByteIndex: 24
        });
        advancedFarmCalls[2] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.getStalk.selector, address(0)),
            clipboard: 0x00
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
        operatorPasteParams[2] = OperatorPasteParams({
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
                libTransfer.From.INTERNAL,
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
        operatorPasteParams = abi.encode(operatorPasteParams);
    }

    /// @notice Generate a standard blueprint that allows the operator to Mow any deposit. Operator is paid in Beans,
    ///         proportional to Stalk increase.
    function draftMow() {
        // One array of OperatorPasteParams for the entire blueprint.
        OperatorPasteParams[] memory operatorPasteParams = new OperatorPasteParams[](5);

        // Advanced Farm calls, composed of calldata and return paste params (clipboard).
        AdvancedFarmCalls[] memory advancedFarmCalls = new AdvancedFarmCalls[](6);

        ////// getStalk(publisher) - returnData[0] //////
        operatorPasteParams[0] = OperatorPasteParams({
            copyByteIndex: 0,
            pasteCallIndex: 0,
            pasteByteIndex: 24
        });
        advancedFarmCalls[0] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.getStalk.selector, address(0)),
            clipboard: 0x00
        });

        ////// Mow(account, token) - returnData[1] //////
        operatorPasteParams[1] = OperatorPasteParams({
            copyByteIndex: OPERATOR_COPY_INDEX,
            pasteCallIndex: 1,
            pasteByteIndex: 24
        });
        operatorPasteParams[2] = OperatorPasteParams({
            copyByteIndex: 0,
            pasteCallIndex: 1,
            pasteByteIndex: 24 + 20
        });
        advancedFarmCalls[1] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.Mow.selector, address(0), address(0)),
            clipboard: 0x00
        });

        ////// getStalk(publisher) - returnData[2] //////
        operatorPasteParams[3] = OperatorPasteParams({
            copyByteIndex: PUBLISHER_COPY_INDEX,
            pasteCallIndex: 2,
            pasteByteIndex: 24
        });
        advancedFarmCalls[2] = AdvancedFarmCall({
            callData: abi.encodeWithSelector(beanstalk.getStalk.selector, address(0)),
            clipboard: 0x00
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
        operatorPasteParams[4] = OperatorPasteParams({
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
                libTransfer.From.INTERNAL,
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
        operatorPasteParams = abi.encode(operatorPasteParams);
    }
}
