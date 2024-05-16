/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Listing} from "./Listing.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {C} from "contracts/C.sol";

/**
 * @author Beanjoyer, Malteasy, funderbrker
 **/

contract Order is Listing {
    struct PodOrder {
        address orderer;
        uint256 fieldIndex;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        uint256 minFillAmount;
    }

    event PodOrderCreated(
        address indexed orderer,
        bytes32 id,
        uint256 beanAmount,
        uint256 fieldIndex,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    );

    event PodOrderFilled(
        address indexed filler,
        address indexed orderer,
        bytes32 id,
        uint256 fieldIndex,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint256 costInBeans
    );

    event PodOrderCancelled(address indexed orderer, uint256 fieldIndex, bytes32 id);

    /*
     * Create
     */
    function _createPodOrder(
        PodOrder calldata podOrder,
        uint256 beanAmount
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        require(podOrder.pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

        id = _getOrderId(podOrder);

        if (s.podOrders[id] > 0) _cancelPodOrder(podOrder, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        emit PodOrderCreated(
            podOrder.orderer,
            id,
            beanAmount,
            podOrder.fieldIndex,
            podOrder.pricePerPod,
            podOrder.maxPlaceInLine,
            podOrder.minFillAmount
        );
    }

    /*
     * Fill
     * @param index The index of the plot in the order.
     */
    function _fillPodOrder(
        PodOrder calldata podOrder,
        address filler,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        LibTransfer.To mode
    ) internal {
        require(
            podAmount >= podOrder.minFillAmount,
            "Marketplace: Fill must be >= minimum amount."
        );
        require(
            s.accounts[filler].fields[podOrder.fieldIndex].plots[index] >= (start + podAmount),
            "Marketplace: Invalid Plot."
        );
        require(
            (index + start + podAmount - s.fields[podOrder.fieldIndex].harvestable) <=
                podOrder.maxPlaceInLine,
            "Marketplace: Plot too far in line."
        );

        bytes32 id = _getOrderId(podOrder);

        uint256 costInBeans = (podAmount * podOrder.pricePerPod) / 1000000;
        require(costInBeans <= s.podOrders[id], "Marketplace: Not enough beans in order.");
        s.podOrders[id] = s.podOrders[id] - costInBeans;

        LibTransfer.sendToken(C.bean(), costInBeans, filler, mode);

        if (s.podListings[_getListingId(podOrder.fieldIndex, index)] == true) {
            _cancelPodListing(filler, podOrder.fieldIndex, index);
        }

        _transferPlot(filler, podOrder.orderer, podOrder.fieldIndex, index, start, podAmount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];

        emit PodOrderFilled(
            filler,
            podOrder.orderer,
            id,
            podOrder.fieldIndex,
            index,
            start,
            podAmount,
            costInBeans
        );
    }

    /*
     * Cancel
     */
    function _cancelPodOrder(PodOrder memory podOrder, LibTransfer.To mode) internal {
        bytes32 id = _getOrderId(podOrder);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, podOrder.orderer, mode);
        delete s.podOrders[id];
        emit PodOrderCancelled(podOrder.orderer, podOrder.fieldIndex, id);
    }

    /*
     * Get
     */

    function _getOrderId(PodOrder memory podOrder) internal pure returns (bytes32 id) {
        return
            keccak256(
                abi.encodePacked(
                    podOrder.orderer,
                    podOrder.fieldIndex,
                    podOrder.pricePerPod,
                    podOrder.maxPlaceInLine,
                    podOrder.minFillAmount
                )
            );
    }
}
