/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {C} from "contracts/C.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";

/**
 * Initializes the Migration of the Unripe LP underlying tokens from Bean:3Crv to Bean:Eth.
 */
contract InitInvariants {
    AppStorage internal s;

    function init() external {
        // TODO: Proper initialization
        // s.internalTokenBalanceTotal[] = 0;

        // TODO: Proper initialization
        s.fertilizedPaidIndex = 4_000_000_000_000;
    }
}
