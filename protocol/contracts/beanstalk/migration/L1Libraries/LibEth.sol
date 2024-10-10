/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

import "./LibL1AppStorage.sol";

/**
 * @author Publius
 * @title LibEth
 **/

library LibEth {
    function refundEth() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (address(this).balance > 0 && s.isFarm != 2) {
            (bool success, ) = msg.sender.call{value: address(this).balance}(new bytes(0));
            require(success, "Eth transfer Failed.");
        }
    }
}
