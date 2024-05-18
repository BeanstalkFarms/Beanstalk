/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedWhitelist whitelists various silo assets.
 * @dev assets that may be whitelisted are dependent on the DAO.
 */
contract ReseedWhitelist {
    AppStorage internal s;

    function init() external {}
}
