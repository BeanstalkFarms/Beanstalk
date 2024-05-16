/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Order} from "./Order.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {C} from "contracts/C.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";

/**
 * @author Beanjoyer, Malteasy
 **/

contract MarketplaceFacet is Invariable, Order {
    /*
     * Pod Listing
     */

    function createPodListing(
        PodListing calldata podListing
    ) external payable fundsSafu noNetFlow noSupplyChange {
        require(podListing.lister == LibTractor._user(), "Marketplace: Non-user create listing.");
        _createPodListing(podListing);
    }

    // Fill
    function fillPodListing(
        PodListing calldata podListing,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        beanAmount = LibTransfer.transferToken(
            C.bean(),
            LibTractor._user(),
            podListing.lister,
            beanAmount,
            mode,
            podListing.mode
        );
        _fillListing(podListing, LibTractor._user(), beanAmount);
    }

    // Cancel
    function cancelPodListing(
        uint256 fieldIndex,
        uint256 index
    ) external payable fundsSafu noNetFlow noSupplyChange {
        _cancelPodListing(LibTractor._user(), fieldIndex, index);
    }

    // Get
    function listingId(uint256 fieldIndex, uint256 index) external pure returns (bytes32 id) {
        return _getListingId(fieldIndex, index);
    }

    function podListing(bytes32 id) external view returns (bool) {
        return s.podListings[id];
    }

    /*
     * Pod Orders
     */

    // Create
    function createPodOrder(
        PodOrder calldata podOrder,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable fundsSafu noSupplyChange noOutFlow returns (bytes32 id) {
        require(podOrder.orderer == LibTractor._user(), "Marketplace: Non-user create order.");
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, LibTractor._user(), mode);
        return _createPodOrder(podOrder, beanAmount);
    }

    // Fill
    function fillPodOrder(
        PodOrder calldata podOrder,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        _fillPodOrder(podOrder, LibTractor._user(), index, start, amount, mode);
    }

    // Cancel
    function cancelPodOrder(
        PodOrder calldata podOrder,
        LibTransfer.To mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        require(podOrder.orderer == LibTractor._user(), "Marketplace: Non-user cancel order.");
        _cancelPodOrder(podOrder, mode);
    }

    // Get

    function orderId(PodOrder calldata podOrder) external pure returns (bytes32 id) {
        return _getOrderId(podOrder);
    }

    function podOrder(bytes32 id) external view returns (uint256) {
        return s.podOrders[id];
    }

    /*
     * Transfer Plot
     */

    function transferPlot(
        address sender,
        address recipient,
        uint256 fieldIndex,
        uint256 index,
        uint256 start,
        uint256 end
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(
            sender != address(0) && recipient != address(0),
            "Field: Transfer to/from 0 address."
        );
        uint256 amountInPlot = s.accounts[sender].fields[fieldIndex].plots[index];
        require(amountInPlot > 0, "Field: Plot not owned by user.");
        require(end > start && amountInPlot >= end, "Field: Pod range invalid.");
        uint256 transferAmount = end - start;
        if (
            LibTractor._user() != sender &&
            allowancePods(sender, LibTractor._user(), fieldIndex) != type(uint256).max
        ) {
            decrementAllowancePods(sender, LibTractor._user(), fieldIndex, transferAmount);
        }

        if (s.podListings[_getListingId(fieldIndex, index)] == true) {
            _cancelPodListing(sender, fieldIndex, index);
        }
        _transferPlot(sender, recipient, fieldIndex, index, start, transferAmount);
    }

    function approvePods(
        address spender,
        uint256 fieldIndex,
        uint256 amount
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(LibTractor._user(), spender, fieldIndex, amount);
        emit PodApproval(LibTractor._user(), spender, fieldIndex, amount);
    }
}
