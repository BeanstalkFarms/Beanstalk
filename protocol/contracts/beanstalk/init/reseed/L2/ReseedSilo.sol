/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedSilo re-initializes the silo.
 * @dev deposits are re-issued to each holder. Silo is set to L1 state.
 */
contract ReseedSilo {
    AppStorage internal s;

    function init() external {}
}
