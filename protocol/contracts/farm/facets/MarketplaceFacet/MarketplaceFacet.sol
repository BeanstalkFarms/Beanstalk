/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Order.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/
 
contract MarketplaceFacet is Order {
    /*
     * Pod Listing
     */

    // Create
    function createPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode
    ) external payable {
        _createPodListing(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode
        );
    }

    function create4PiecesDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial_4 calldata f
    ) external payable {
        _create4PiecesDynamicPodListing(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode,
            f
        );
    }

    function create16PiecesDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial_16 calldata f
    ) external payable {
        _create16PiecesDynamicPodListing(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode,
            f
        );
    }

    function create64PiecesDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial_64 calldata f
    ) external payable {
        _create64PiecesDynamicPodListing(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode,
            f
        );
    }

    // Fill
    function fillPodListing(
        PodListing calldata l,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable {
        beanAmount = LibTransfer.transferToken(
            C.bean(),
            l.account,
            beanAmount,
            mode,
            l.mode
        );
        _fillListing(l, beanAmount);
    }

    function fill4PiecesDynamicPodListing(
        PodListing calldata l,
        PiecewisePolynomial_4 calldata f,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable {
        beanAmount = LibTransfer.transferToken(
            C.bean(),
            l.account,
            beanAmount,
            mode,
            l.mode
        );
        _fill4PiecesDynamicListing(l, f, beanAmount);
    }

    function fill16PiecesDynamicPodListing(
        PodListing calldata l,
        PiecewisePolynomial_16 calldata f,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable {
        beanAmount = LibTransfer.transferToken(
            C.bean(),
            l.account,
            beanAmount,
            mode,
            l.mode
        );
        _fill16PiecesDynamicListing(l, f, beanAmount);
    }

    function fill64PiecesDynamicPodListing(
        PodListing calldata l,
        PiecewisePolynomial_64 calldata f,
        uint256 beanAmount,
        LibTransfer.From mode
    ) external payable {
        beanAmount = LibTransfer.transferToken(
            C.bean(),
            l.account,
            beanAmount,
            mode,
            l.mode
        );
        _fill64PiecesDynamicListing(l, f, beanAmount);
    }

    // Cancel
    function cancelPodListing(uint256 index) external payable {
        _cancelPodListing(msg.sender, index);
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
        LibTransfer.From mode
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
    }

    function create4PiecesDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.From mode,
        PiecewisePolynomial_4 calldata f
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _create4PiecesDynamicPodOrder(beanAmount, pricePerPod, maxPlaceInLine, f);
    }

    function create16PiecesDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.From mode,
        PiecewisePolynomial_16 calldata f
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _create16PiecesDynamicPodOrder(beanAmount, pricePerPod, maxPlaceInLine, f);
    }

    function create64PiecesDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.From mode,
        PiecewisePolynomial_64 calldata f
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _create64PiecesDynamicPodOrder(beanAmount, pricePerPod, maxPlaceInLine, f);
    }

    // Fill
    function fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fillPodOrder(o, index, start, amount, mode);
    }

    function fill4PiecesDynamicPodOrder(
        PodOrder calldata o,
        PiecewisePolynomial_4 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fill4PiecesDynamicPodOrder(o, f, index, start, amount, mode);
    }

    function fill16PiecesDynamicPodOrder(
        PodOrder calldata o,
        PiecewisePolynomial_16 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fill16PiecesDynamicPodOrder(o, f, index, start, amount, mode);
    }

    function fill64PiecesDynamicPodOrder(
        PodOrder calldata o,
        PiecewisePolynomial_64 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fill64PiecesDynamicPodOrder(o, f, index, start, amount, mode);
    }

    // Cancel
    function cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode
    ) external payable {
        _cancelPodOrder(pricePerPod, maxPlaceInLine, mode);
    }

    function cancel4PiecesDynamicPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        PiecewisePolynomial_4 calldata f
    ) external payable {
        _cancel4PiecesDynamicPodOrder(pricePerPod, maxPlaceInLine, mode, f);
    }

    function cancel16PiecesDynamicPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        PiecewisePolynomial_16 calldata f
    ) external payable {
        _cancel16PiecesDynamicPodOrder(pricePerPod, maxPlaceInLine, mode, f);
    }

    function cancel64PiecesDynamicPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        PiecewisePolynomial_64 calldata f
    ) external payable {
        _cancel64PiecesDynamicPodOrder(pricePerPod, maxPlaceInLine, mode, f);
    }


    // Get

    function podOrder(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) external view returns (uint256) {
        return s.podOrders[
            createOrderId(
                account, 
                pricePerPod, 
                maxPlaceInLine
            )
        ];
    }

    function dynamicPodOrder4(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PiecewisePolynomial_4 calldata f
    ) external view returns (uint256) {
        return s.podOrders[
            create4PiecesDynamicOrderId(
                account, 
                pricePerPod, 
                maxPlaceInLine, 
                f.breakpoints, 
                f.significands, 
                f.packedExponents, 
                f.packedSigns
            )
        ];
    }

    function dynamicPodOrder16(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PiecewisePolynomial_16 calldata f
    ) external view returns (uint256) {
        return s.podOrders[
            create16PiecesDynamicOrderId(
                account, 
                pricePerPod, 
                maxPlaceInLine, 
                f.breakpoints, 
                f.significands, 
                f.packedExponents, 
                f.packedSigns
            )
        ];
    }

    function dynamicPodOrder64(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PiecewisePolynomial_64 calldata f
    ) external view returns (uint256) {
        return s.podOrders[
            create64PiecesDynamicOrderId(
                account, 
                pricePerPod, 
                maxPlaceInLine, 
                f.breakpoints, 
                f.significands, 
                f.packedExponents, 
                f.packedSigns
            )
        ];
    }

    function podOrderById(bytes32 id) external view returns (uint256) {
        return s.podOrders[id];
    }

    /*
     * Transfer Plot
     */

    function transferPlot(
        address sender,
        address recipient,
        uint256 id,
        uint256 start,
        uint256 end
    ) external payable nonReentrant {
        require(
            sender != address(0) && recipient != address(0),
            "Field: Transfer to/from 0 address."
        );
        uint256 amount = s.a[sender].field.plots[id];
        require(amount > 0, "Field: Plot not owned by user.");
        require(end > start && amount >= end, "Field: Pod range invalid.");
        amount = end - start; // Note: SafeMath is redundant here.
        if (msg.sender != sender && allowancePods(sender, msg.sender) != uint256(-1)) {
                decrementAllowancePods(sender, msg.sender, amount);
        }

        if (s.podListings[id] != bytes32(0)){
            _cancelPodListing(sender, id);
        }
        _transferPlot(sender, recipient, id, start, amount);
    }

    function approvePods(address spender, uint256 amount)
        external
        payable
        nonReentrant
    {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(msg.sender, spender, amount);
        emit PodApproval(msg.sender, spender, amount);
    }

}
