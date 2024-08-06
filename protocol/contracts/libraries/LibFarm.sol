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
    /**
     * @notice Delegatecall an external facing Beanstalk function, optionally using a clipboard.
     * @param data The calldata of the call.
     * @param returnData The return data of all previous calls.
     */
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

    /**
     * @notice Delegatecall an external facing Beanstalk function.
     * @param data The calldata of the call.
     */
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

    /**
     * @notice Swap reentrancy locks, such that standard reentrant is unlocked and farming is locked.
     * @dev All Beanstalk write functions should be nonReentrant, immediately returning reentrant status to entered.
     * @dev This logic pertains to ReentrancyGuard, but Solidity limitations require it to be be placed here.
     * @param facet The address of the facet containing the function to call.
     * @param data The calldata of the call.
     */
    function _beanstalkCall(
        address facet,
        bytes memory data
    ) private returns (bool success, bytes memory result) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Verify that farm reentrancy is already protected.
        require(s.sys.farmingStatus == C.ENTERED, "Unprotected farm call");

        // Temporarily unlock non-farming reentrancy to allow a single Beanstalk call.
        s.sys.reentrantStatus = C.NOT_ENTERED;
        (success, result) = facet.delegatecall(data);
        s.sys.reentrantStatus = C.ENTERED;
    }
}
