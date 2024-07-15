/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "../../C.sol";
import "../../tokens/Fertilizer/Fertilizer.sol";

/**
 * @author deadmanwalking
 * @title InitFertUpdate the updating of Fertilizer.
**/

contract InitFertUpdate {

    AppStorage internal s;

    function init() external {
        
        //deploy new Fertilizer implementation
        Fertilizer fertilizer = new Fertilizer();
        // get the address of the new Fertilizer implementation
        address fertilizerImplementation = address(fertilizer);

        // upgrade to new Fertilizer implementation
        C.fertilizerAdmin().upgrade(
            C.fertilizerAddress(), // proxy
            fertilizerImplementation // new implementation
        );
    }
}
