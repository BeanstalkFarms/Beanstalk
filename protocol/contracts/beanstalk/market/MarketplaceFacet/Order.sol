/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibMarket} from "contracts/libraries/LibMarket.sol";
import {Listing} from "./Listing.sol";

/**
 * @author Beanjoyer, Malteasy, funderbrker
 **/

contract Order is Listing {
    struct PodOrder {
        address orderer;
        uint256 fieldId;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        uint256 minFillAmount;
    }

    event PodOrderCreated(
        address indexed orderer,
        bytes32 id,
        uint256 beanAmount,
        uint256 fieldId,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    );

    event PodOrderFilled(
        address indexed filler,
        address indexed orderer,
        bytes32 id,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint256 costInBeans
    );

    event PodOrderCancelled(address indexed orderer, bytes32 id);

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

        if (s.sys.podOrders[id] > 0) _cancelPodOrder(podOrder, LibTransfer.To.INTERNAL);
        s.sys.podOrders[id] = beanAmount;

        emit PodOrderCreated(
            podOrder.orderer,
            id,
            beanAmount,
            podOrder.fieldId,
            podOrder.pricePerPod,
            podOrder.maxPlaceInLine,
            podOrder.minFillAmount
        );
    }

    /*
     * Fill
     * @param index The index of the plot in the order.
     * @dev Verification that sender == filler should be handled before calling this function.
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
            s.accts[filler].fields[podOrder.fieldId].plots[index] >= (start + podAmount),
            "Marketplace: Invalid Plot."
        );
        require(
            (index + start + podAmount - s.sys.fields[podOrder.fieldId].harvestable) <=
                podOrder.maxPlaceInLine,
            "Marketplace: Plot too far in line."
        );

        bytes32 id = _getOrderId(podOrder);

        uint256 costInBeans = (podAmount * podOrder.pricePerPod) / 1000000;
        require(costInBeans <= s.sys.podOrders[id], "Marketplace: Not enough beans in order.");
        s.sys.podOrders[id] = s.sys.podOrders[id] - costInBeans;

        LibTransfer.sendToken(C.bean(), costInBeans, filler, mode);

        if (s.sys.podListings[podOrder.fieldId][index] != bytes32(0)) {
            LibMarket._cancelPodListing(filler, podOrder.fieldId, index);
        }

        _transferPlot(filler, podOrder.orderer, podOrder.fieldId, index, start, podAmount);

        if (s.sys.podOrders[id] == 0) {
            delete s.sys.podOrders[id];
        }

        emit PodOrderFilled(
            filler,
            podOrder.orderer,
            id,
            podOrder.fieldId,
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
        uint256 amountBeans = s.sys.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, podOrder.orderer, mode);
        delete s.sys.podOrders[id];
        emit PodOrderCancelled(podOrder.orderer, id);
    }

    /*
     * Get
     */

    function _getOrderId(PodOrder memory podOrder) internal pure returns (bytes32 id) {
        return
            keccak256(
                abi.encodePacked(
                    podOrder.orderer,
                    podOrder.fieldId,
                    podOrder.pricePerPod,
                    podOrder.maxPlaceInLine,
                    podOrder.minFillAmount
                )
            );
    }
}
