/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Order} from "./Order.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {C} from "contracts/C.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibMarket} from "contracts/libraries/LibMarket.sol";

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
        uint256 fieldId,
        uint256 index
    ) external payable fundsSafu noNetFlow noSupplyChange {
        LibMarket._cancelPodListing(LibTractor._user(), fieldId, index);
    }

    function getPodListing(uint256 fieldId, uint256 index) external view returns (bytes32 id) {
        return s.sys.podListings[fieldId][index];
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

    function getOrderId(PodOrder calldata podOrder) external pure returns (bytes32 id) {
        return _getOrderId(podOrder);
    }

    function getPodOrder(bytes32 id) external view returns (uint256) {
        return s.sys.podOrders[id];
    }

    /*
     * Transfer Plot
     */

    /**
     * @notice transfers a plot from `sender` to `recipient`.
     */
    function transferPlot(
        address sender,
        address recipient,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 end
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(
            sender != address(0) && recipient != address(0),
            "Field: Transfer to/from 0 address."
        );
        uint256 transferAmount = validatePlotAndReturnPods(fieldId, sender, index, start, end);
        if (
            LibTractor._user() != sender &&
            allowancePods(sender, LibTractor._user(), fieldId) != type(uint256).max
        ) {
            decrementAllowancePods(sender, LibTractor._user(), fieldId, transferAmount);
        }

        if (s.sys.podListings[fieldId][index] != bytes32(0)) {
            LibMarket._cancelPodListing(sender, fieldId, index);
        }
        _transferPlot(sender, recipient, fieldId, index, start, transferAmount);
    }

    /**
     * @notice transfers multiple plots from `sender` to `recipient`.
     */
    function transferPlots(
        address sender,
        address recipient,
        uint256 fieldId,
        uint256[] calldata ids,
        uint256[] calldata starts,
        uint256[] calldata ends
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(
            sender != address(0) && recipient != address(0),
            "Field: Transfer to/from 0 address."
        );
        require(
            ids.length == starts.length && ids.length == ends.length,
            "Field: Array length mismatch."
        );
        uint256 totalAmount = _transferPlots(sender, recipient, fieldId, ids, starts, ends);

        // Decrement allowance is done on totalAmount rather than per plot.
        if (
            LibTractor._user() != sender &&
            allowancePods(sender, LibTractor._user(), fieldId) != type(uint256).max
        ) {
            decrementAllowancePods(sender, LibTractor._user(), totalAmount, fieldId);
        }
    }

    /**
     * @notice internal function to transfer multiple plots from `sender` to `recipient`.
     * @dev placed in a function due to stack.
     */
    function _transferPlots(
        address sender,
        address recipient,
        uint256 fieldId,
        uint256[] calldata ids,
        uint256[] calldata starts,
        uint256[] calldata ends
    ) internal returns (uint256 totalAmount) {
        for (uint256 i; i < ids.length; i++) {
            uint256 amount = validatePlotAndReturnPods(fieldId, sender, ids[i], starts[i], ends[i]);
            if (s.sys.podListings[fieldId][ids[i]] != bytes32(0)) {
                LibMarket._cancelPodListing(sender, fieldId, ids[i]);
            }
            _transferPlot(sender, recipient, fieldId, ids[i], starts[i], amount);
            totalAmount += amount;
        }
    }

    /**
     * @notice validates the plot is valid and returns the pod being sent.
     */
    function validatePlotAndReturnPods(
        uint256 fieldId,
        address sender,
        uint256 id,
        uint256 start,
        uint256 end
    ) internal view returns (uint256 amount) {
        amount = s.accts[sender].fields[fieldId].plots[id];
        require(amount > 0, "Field: Plot not owned by user.");
        require(end > start && amount >= end, "Field: Pod range invalid.");
        amount = end - start;
    }

    function approvePods(
        address spender,
        uint256 fieldId,
        uint256 amount
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(LibTractor._user(), spender, fieldId, amount);
        emit PodApproval(LibTractor._user(), spender, fieldId, amount);
    }
}
