/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {LibFunction} from "./LibFunction.sol";
import {LibClipboard} from "./LibClipboard.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @title Farm Lib
 * @author Beasley, Publius
 * @notice Perform multiple Beanstalk functions calls in a single transaction using Farm calls.
 * Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)
 **/

// AdvancedFarmCall is a Farm call that can use a Clipboard.
// See LibFunction.useClipboard for details
struct AdvancedFarmCall {
    bytes callData;
    bytes clipboard;
}

library LibFarm {
    function _advancedFarm(
        AdvancedFarmCall memory data,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        bytes1 pipeType = data.clipboard.length == 0 ? bytes1(0) : data.clipboard[0];
        // 0x00 -> Static Call - Execute static call
        // else > Advanced Call - Use clipboard on and execute call.
        if (pipeType == 0x00) {
            result = _farm(data.callData);
        } else {
            bytes memory callData = LibClipboard.useClipboard(
                data.callData,
                data.clipboard,
                returnData
            );
            result = _farm(callData);
        }
    }

    // delegatecall a Beanstalk function using memory data
    function _farm(bytes memory data) internal returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := mload(add(data, 32))
        }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = _beanstalkCall(facet, data);
        LibFunction.checkReturn(success, result);
    }

    // Any public facing Beanstalk function should call nonReentrancy, thus the status will immediately return to ENTERED.
    // this logic belongs in reentrancy guard, but solidity >:(
    function _beanstalkCall(
        address facet,
        bytes memory data
    ) internal returns (bool success, bytes memory result) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(s.sys.farmingStatus != C.ENTERED, "Reentrant farm call");

        s.sys.farmingStatus = C.ENTERED;
        s.sys.reentrantStatus = C.NOT_ENTERED;
        (success, result) = facet.delegatecall(data);
        s.sys.farmingStatus = C.NOT_ENTERED;
        s.sys.reentrantStatus = C.ENTERED;
    }
}
