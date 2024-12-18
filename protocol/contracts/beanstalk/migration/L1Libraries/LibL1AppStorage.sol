// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

// Import all of AppStorage to give importers of LibAppStorage access to {Account}, etc.
import "../L1AppStorage.sol";

/**
 * @title LibAppStorage
 * @author Publius
 * @notice Allows libaries to access Beanstalk's state.
 */
library LibAppStorage {
    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }
}
