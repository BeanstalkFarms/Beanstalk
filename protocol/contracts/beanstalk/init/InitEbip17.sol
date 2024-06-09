/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";

/**
 * @author Brean
 * @title InitEBip17 cancels the invalid pod orders, and recreates the pod orders with the correct values.
 **/
contract InitEbip17 {
    AppStorage internal s;

    // there are 4 existing pod orders, 2 of which have a min fill amount of 0.
    // 0x0503e8467eb328bcb9b1f2656db905311d47cb14ea1955b8a0c8441d8943ca33,
    // 0xf47df2678d29e9d57c5e9ed5f8c990e71910918154a2ed6d5235718035d7d8b0.
    // these orders are invalid, as they have a min fill amount of 0, and will need to be re-created.
    function init() external {
        // get bean order values.
        uint256 beanAmount0 = s.podOrders[0x0503e8467eb328bcb9b1f2656db905311d47cb14ea1955b8a0c8441d8943ca33];
        uint256 beanAmount1 = s.podOrders[0xf47df2678d29e9d57c5e9ed5f8c990e71910918154a2ed6d5235718035d7d8b0];

        // cancel orders.
        delete s.podOrders[0x0503e8467eb328bcb9b1f2656db905311d47cb14ea1955b8a0c8441d8943ca33];
        delete s.podOrders[0xf47df2678d29e9d57c5e9ed5f8c990e71910918154a2ed6d5235718035d7d8b0];

        // reinitalize orders, with a min fill amount of 1.
        s.podOrders[createOrderId(address(0x8a9C930896e453cA3D87f1918996423A589Dd529), 1000, 109233726000000, 1)] = beanAmount0;
        s.podOrders[createOrderId(address(0x8a9C930896e453cA3D87f1918996423A589Dd529), 1000, 109233726000000, 1)] = beanAmount1;
    }

    // see: {Order.createOrderId}
    function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    ) internal pure returns (bytes32 id) {
        if(minFillAmount > 0) id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount));
        else id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));
    }

}
