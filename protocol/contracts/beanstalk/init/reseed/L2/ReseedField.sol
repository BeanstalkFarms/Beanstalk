/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedField re-initializes the field.
 * @dev plots are re-issued to existing farmers. Field is set to L1 state.
 */
contract ReseedField {
    AppStorage internal s;

    function init() external {}
}
