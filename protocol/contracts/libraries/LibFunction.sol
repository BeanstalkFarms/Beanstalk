/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";
import "hardhat/console.sol";

/**
 * @title Lib Function
 **/

library LibFunction {
    // Checks the return of a any function call for success, if not returns the error returned in `results`
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

    // Gets the facet address for a given selector. Fails if no set Facet address.
    function facetForSelector(bytes4 selector)
        internal
        view
        returns (address facet)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facet = ds.selectorToFacetAndPosition[selector].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
    }

    function buildAdvancedCalldata(
        bytes calldata callData,
        bytes calldata advancedData,
        bytes[] memory returnData
    ) internal returns (bytes memory data) {
        bytes1 typeId = advancedData[0];
        if (typeId == 0x01) {
            bytes32 copyParams = abi.decode(advancedData, (bytes32));
            data = LibFunction.pasteBytes(
                returnData,
                callData,
                copyParams
            );
        } else if (typeId == 0x02) {
            (, bytes32[] memory copyParams) = abi.decode(
                advancedData,
                (uint256, bytes32[])
            );
            data = callData;
            for (uint256 i; i < copyParams.length; i++)
                data = LibFunction.pasteBytes(
                    returnData,
                    data,
                    copyParams[i]
                );
        } else {
            revert("Function: Advanced Type not supported");
        }
    }

    // pasteBytes copies 32 bytes from a `returnData` to `callData`.
    // The copy and paste location are encoded via `encodePacked` into a bytes32 slot.
    // copyParams has the following layout:
    //   2 bytes |  10 bytes        | 10 bytes  | 10 bytes
    //  [ other  | returnData index | copyIndex | pasteIndex ]
    function pasteBytes(
        bytes[] memory returnData,
        bytes memory callData,
        bytes32 copyParams
    ) internal view returns (bytes memory) {
        // Shift `copyParams` right 22 bytes to insolated index in return data.
        console.logBytes32(copyParams);
        bytes memory copyData = returnData[uint256((copyParams << 16) >> 176)];
        console.log("--------");
        console.logBytes(copyData);
        console.logBytes(callData);
        assembly {
            mstore(
                // Paste bytes at callData index + 32 + pasteIndex
                // add 32 because first 32 bytes of `bytes` datatype is length and
                // next 4 bytes is the function selector. Neither of which we want to overwrite.
                // pasteIndex is isolated by shifting copyParams 22 bytes left and then 22 bytes right
                add(add(callData, 36), shr(176, shl(176, copyParams))),
                // copy bytes from copyBytes + 32 + copyIndex
                // add 32 because first 32 bytes of `bytes` datatype is length, which we don't want to overwrite
                // copyIndex is isolated by shifting copyParams 12 bytes left and then 22 bytes right
                mload(add(add(copyData, 32), shr(176, shl(96, copyParams))))
            )
        }
        console.logBytes(callData);
        console.log("--------");
        return callData;
    }
}
