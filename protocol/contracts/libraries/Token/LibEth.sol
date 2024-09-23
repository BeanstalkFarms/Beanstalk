/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "../LibAppStorage.sol";
import "../LibTractor.sol";

/**
 * @author Publius
 * @title LibEth
 **/

library LibEth {
    function refundEth() internal {
        if (address(this).balance > 0) {
            (bool success, ) = LibTractor._user().call{value: address(this).balance}(new bytes(0));
            require(success, "Eth transfer Failed.");
        }
    }
}
