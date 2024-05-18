/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed re-initializes the internal balance of farmers.
 * @dev non bean assets cannot be transfered to L2, due to the lack of garentee of the asset's Liquidity.
 */
contract ReseedInternalBalances {
    AppStorage internal s;

    function init() external {}
}
