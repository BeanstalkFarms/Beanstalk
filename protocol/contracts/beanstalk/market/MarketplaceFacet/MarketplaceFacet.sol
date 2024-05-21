/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import "./Order.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";

/**
 * @author Beanjoyer, Malteasy
 **/

contract MarketplaceFacet is Invariable, Order {
    /*
     * Pod Listing
     */

    /*
     * @notice **LEGACY**
     */
    function createPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        LibTransfer.To mode
    ) external payable fundsSafu noNetFlow noSupplyChange {
        _createPodListing(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            minFillAmount,
            mode
        );
    }

    // Fill
    function fillPodListing(
        PodListing calldata l,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        beanAmount = LibTransfer.transferToken(
            C.bean(),
            LibTractor._user(),
            l.account,
            beanAmount,
            mode,
            l.mode
        );
        _fillListing(l, beanAmount);
    }

    // Cancel
    function cancelPodListing(uint256 index) external payable fundsSafu noNetFlow noSupplyChange {
        _cancelPodListing(LibTractor._user(), index);
    }

    // Get
    function podListing(uint256 index) external view returns (bytes32) {
        return s.podListings[index];
    }

    /*
     * Pod Orders
     */

    // Create
    function createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        LibTransfer.From mode
    ) external payable fundsSafu noSupplyChange noOutFlow returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, LibTractor._user(), mode);
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine, minFillAmount);
    }

    // Fill
    function fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        _fillPodOrder(o, index, start, amount, mode);
    }

    // Cancel
    function cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        LibTransfer.To mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        _cancelPodOrder(pricePerPod, maxPlaceInLine, minFillAmount, mode);
    }

    // Get

    function podOrder(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    ) external view returns (uint256) {
        return s.podOrders[createOrderId(account, pricePerPod, maxPlaceInLine, minFillAmount)];
    }

    function podOrderById(bytes32 id) external view returns (uint256) {
        return s.podOrders[id];
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
        uint256 id,
        uint256 start,
        uint256 end
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(
            sender != address(0) && recipient != address(0),
            "Field: Transfer to/from 0 address."
        );
        uint256 amount = validatePlotAndReturnPods(sender, id, start, end);
        if (
            LibTractor._user() != sender &&
            allowancePods(sender, LibTractor._user()) != type(uint256).max
        ) {
            decrementAllowancePods(sender, LibTractor._user(), amount);
        }

        if (s.podListings[id] != bytes32(0)) {
            _cancelPodListing(sender, id);
        }

        _transferPlot(sender, recipient, id, start, amount);
    }

    /**
     * @notice transfers multiple plots from `sender` to `recipient`.
     */
    function transferPlots(
        address sender,
        address recipient,
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
        uint256 totalAmount = _transferPlots(sender, recipient, ids, starts, ends);

        // Decrement allowance is done on totalAmount rather than per plot.
        if (
            LibTractor._user() != sender &&
            allowancePods(sender, LibTractor._user()) != type(uint256).max
        ) {
            decrementAllowancePods(sender, LibTractor._user(), totalAmount);
        }
    }

    /**
     * @notice internal function to transfer multiple plots from `sender` to `recipient`.
     * @dev placed in a function due to stack.
     */
    function _transferPlots(
        address sender,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata starts,
        uint256[] calldata ends
    ) internal returns (uint256 totalAmount) {
        for (uint256 i; i < ids.length; i++) {
            uint256 amount = validatePlotAndReturnPods(sender, ids[i], starts[i], ends[i]);
            if (s.podListings[ids[i]] != bytes32(0)) {
                _cancelPodListing(sender, ids[i]);
            }
            _transferPlot(sender, recipient, ids[i], starts[i], amount);
            totalAmount += amount;
        }
    }

    /**
     * @notice validates the plot is valid and returns the pod being sent.
     */
    function validatePlotAndReturnPods(
        address sender,
        uint256 id,
        uint256 start,
        uint256 end
    ) internal view returns (uint256 amount) {
        amount = s.a[sender].field.plots[id];
        require(amount > 0, "Field: Plot not owned by user.");
        require(end > start && amount >= end, "Field: Pod range invalid.");
        amount = end - start;
    }

    function approvePods(
        address spender,
        uint256 amount
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(LibTractor._user(), spender, amount);
        emit PodApproval(LibTractor._user(), spender, amount);
    }
}
