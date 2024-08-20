/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";

/**
 * @author Brean
 * @notice ReseedTransferOwnership transfers ownership of the contract to a new owner.
 */
contract ReseedTransferOwnership {
    AppStorage internal s;

    function init(address newOwner) external {
        s.sys.ownerCandidate = newOwner;
    }
}
