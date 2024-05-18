/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed Barn re-initializes fertilizer.
 * @dev Fertilizer is re-issued to each holder. Barn raise is set to L1 state.
 */
contract ReseedBarn {
    AppStorage internal s;

    function init() external {}
}
