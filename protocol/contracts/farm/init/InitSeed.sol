/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../Seed.sol";
import "../../interfaces/ISeed.sol";
import {AppStorage} from "../AppStorage.sol";

contract InitSeed {

    AppStorage internal s;

    function init() external {
//         s.seedContract = address(new seed());
    }
}
