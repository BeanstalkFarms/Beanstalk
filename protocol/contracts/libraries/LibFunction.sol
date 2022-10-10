/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";

/**
 * @title Lib Function
 **/

library LibFunction {
    /**
     * @notice Checks The return of a any function call for success, if not returns the error returned in `results`
     * @param success Whether the corresponding function call succeeded
     * @param result The return data of the corresponding function call
    **/
    function checkReturn(bool success, bytes memory result) internal pure {
        if (!success) {
            // Next 5 lines from https://ethereum.stackexchange.com/a/83577
            // Also, used in Uniswap V3 https://github.com/Uniswap/v3-periphery/blob/main/contracts/base/Multicall.sol#L17
            if (result.length < 68) revert();
            assembly {
                result := add(result, 0x04)
            }
            revert(abi.decode(result, (string)));
        }
    }

    /**
     * @notice Gets the facet address for a given selector
     * @param selector The function selector to fetch the facet address for
     * @dev Fails if no set Facet address
     * @return facet The facet address
    **/
    function facetForSelector(bytes4 selector)
        internal
        view
        returns (address facet)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facet = ds.selectorToFacetAndPosition[selector].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
    }

    /**
     * @notice Handles copying data from return data of previous function calls 
     * into the callData of a subsequent function calls
     * @param callData The callData bytes of the next function call
     * @param advancedData The encoded advanced bytes for the advanced function call
     * Advanced function data takes this form:
     * [ Type   | padding         | Type data      | Ether Value (only if flag == 1)]
     * [ 1 byte | 1 byte          | n bytes        | 0 or 32 bytes                  ]
     * Type: 0x00, 0x01 or 0x002
        - 0x00: For a basic pipe (Logic in Pipeline.sol and FarmFacet.sol)
        - 0x01: for a single return value copy
        - 0x02: for n return value copies
     * padding: Reserved for Ether value in Pipeline function calls
     * Type Data: bytes
     * Currently, two types are supported. Both types depend on the copyParams data struct
     * Type 1 (0x01): Copy 1 bytes32 from a previous function return value
     * [ copyParams ]
     * [ 30 bytes   ]
     * Note: Should be encoded with ['bytes2', 'uint80', 'uint80', 'uint80']  where the first two bytes are Type and Send Ether Flag if using Pipeline
     * Type 2 (0x02): Copy n bytes32 from a previous function return value
     * [ padding  | copyParams[]       ]
     * [ 30 bytes | (n + 1) * 32 bytes ] 
     * Copy n bytes32 from previous funtion return values
     * @param returnData A list of bytes corresponding to return data from previous function calls in the transaction
     @return data The function call return datas
    **/
    function buildAdvancedCalldata(
        bytes calldata callData,
        bytes calldata advancedData,
        bytes[] memory returnData
    ) internal pure returns (bytes memory data) {
        bytes1 typeId = advancedData[0];
        if (typeId == 0x01) {
            bytes32 copyParams = abi.decode(advancedData, (bytes32));
            data = LibFunction.pasteAdvancedBytes(callData, returnData, copyParams);
        } else if (typeId == 0x02) {
            (, bytes32[] memory copyParams) = abi.decode(
                advancedData,
                (uint256, bytes32[])
            );
            data = callData;
            for (uint256 i; i < copyParams.length; i++)
                data = LibFunction.pasteAdvancedBytes(data, returnData, copyParams[i]);
        } else {
            revert("Function: Advanced Type not supported");
        }
    }

    /**
     * @notice Copies 32 bytes from returnData into callData determined by copyParams
     * @param callData The callData bytes of the next function call
     * @param returnData A list of bytes corresponding to return data from previous function calls in the transaction
     * @param copyParams Denotes which data should be copied and where it should be pasted
     * Should be in the following format
     * [2 bytes | 10 bytes         | 10 bytes  | 10 bytes]
     * [ N/A    | returnDataIndex  | copyIndex | pasteIndex ]
     * @return pastedData the calldata for the next function call with bytes pasted from returnData
     **/
    function pasteAdvancedBytes(
        bytes memory callData,
        bytes[] memory returnData,
        bytes32 copyParams
    ) internal pure returns (bytes memory pastedData) {
        // Shift `copyParams` right 22 bytes to insolated reduceDataIndex
        bytes memory copyData = returnData[uint256((copyParams << 16) >> 176)];
        pastedData = paste32Bytes(
            copyData,
            callData,
            uint256((copyParams << 96) >> 176), // Isolate copyIndex
            uint256((copyParams << 176) >> 176) // Isolate pasteIndex
        );
    }

    /**
     * @notice Copy 32 Bytes from copyData at copyIndex and paste into pasteData at pasteIndex
     * @param copyData The data bytes to copy from
     * @param pasteData The data bytes to paste into
     * @param copyIndex The index in copyData to copying from
     * @param pasteIndex The index in pasteData to paste into
     * @return pastedData The data with the copied with 32 bytes
    **/
    function paste32Bytes(
        bytes memory copyData,
        bytes memory pasteData,
        uint256 copyIndex,
        uint256 pasteIndex
    ) internal pure returns (bytes memory pastedData) {
        assembly {
            mstore(add(pasteData, pasteIndex), mload(add(copyData, copyIndex)))
        }
        pastedData = pasteData;
    }
}
