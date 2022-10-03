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
    function checkReturn(bool success, bytes memory result) internal pure {
        if (!success) {
            // Next 5 lines from https://ethereum.stackexchange.com/a/83577
            if (result.length < 68) revert();
            assembly {
                result := add(result, 0x04)
            }
            revert(abi.decode(result, (string)));
        }
    }

    function facetForSelector(bytes4 selector)
        internal
        view
        returns (address facet)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facet = ds.selectorToFacetAndPosition[selector].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
    }

    // pasteBytes copies 32 bytes from a `returnData` to `callData`.
    // The copy and paste location are encoded via `encodePacked` into a bytes32 slot.
    // copyParams has the following layout:
    //   12 bytes         | 10 bytes  | 10 bytes
    // [ returnData index | copyIndex | pasteIndex ]
    function pasteBytes(
        bytes[] memory returnData,
        bytes memory callData,
        bytes32 copyParams
    ) internal view returns (bytes memory) {
         // Shift `copyParams` right 22 bytes to insolated index in return data.
        bytes memory copyData = returnData[uint256(copyParams >> 160)];
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
        return callData;
    }
}
