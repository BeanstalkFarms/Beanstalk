/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// TODO rm
import "forge-std/console.sol";

import {LibDiamond} from "./LibDiamond.sol";
import {AdvancedFarmCall} from "./LibFarm.sol";

/**
 * @title Lib Function
 * @author Publius
 **/

library LibFunction {
    /**
     * @notice Checks The return value of a any function call for success, if not returns the error returned in `results`
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
     * @dev Fails if no set facet address
     * @return facet The facet address
     **/
    function facetForSelector(bytes4 selector) internal view returns (address facet) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facet = ds.selectorToFacetAndPosition[selector].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
    }

    /**
     * @notice Copy 32 Bytes from copyData at copyIndex and paste into pasteData at pasteIndex
     * @param copyData The data bytes to copy from
     * @param pasteData The data bytes to paste into
     * @param copyIndex The index in copyData to copying from
     * @param pasteIndex The index in pasteData to paste into
     **/
    function paste32Bytes(
        bytes memory copyData,
        bytes memory pasteData,
        uint256 copyIndex,
        uint256 pasteIndex
    ) internal view {
        // returns (bytes memory pastedData) {
        console.log("paste32Bytes");
        console.log(copyIndex);
        console.log(pasteIndex);
        console.logBytes(copyData);
        console.logBytes(pasteData);

        // bytes32 mload_;

        assembly {
            // // Skip length (32 bytes).
            // mload_ := mload(add(add(copyData, 0x20), copyIndex))
            mstore(add(pasteData, pasteIndex), mload(add(copyData, copyIndex)))
            // mstore(
            //     add(add(pasteData, 0x20), pasteIndex),
            //     mload(add(add(copyData, 0x20), copyIndex))
            // )
        }
        console.logBytes(pasteData);
        // console.log("mload_");
        // console.logBytes32(mload_);
        // pastedData = pasteData;
    }
}
