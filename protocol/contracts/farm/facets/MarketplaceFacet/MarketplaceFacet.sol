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
    
    /*
    * @notice **LEGACY**
    */
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

    function createPodListingPiecewise4(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise4 calldata f
    ) external payable {
        _createPodListingPiecewise4(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode,
            f
        );
    }

    function createPodListingPiecewise16(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise16 calldata f
    ) external payable {
        _createPodListingPiecewise16(
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode,
            f
        );
    }

    function createPodListingPiecewise64(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise64 calldata f
    ) external payable {
        _createPodListingPiecewise64(
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

    function fillPodListingPiecewise4(
        PodListing calldata l,
        LibDynamic.CubicPolynomialPiecewise4 calldata f,
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
        _fillListingPiecewise4(l, f, beanAmount);
    }

    function fillPodListingPiecewise16(
        PodListing calldata l,
        LibDynamic.CubicPolynomialPiecewise16 calldata f,
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
        _fillListingPiecewise16(l, f, beanAmount);
    }

    function fillPodListingPiecewise64(
        PodListing calldata l,
        LibDynamic.CubicPolynomialPiecewise64 calldata f,
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
        _fillListingPiecewise64(l, f, beanAmount);
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

    function createPodOrderPiecewise4(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.From mode,
        LibDynamic.CubicPolynomialPiecewise4 calldata f
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _createPodOrderPiecewise4(beanAmount, pricePerPod, maxPlaceInLine, f);
    }

    function createPodOrderPiecewise16(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.From mode,
        LibDynamic.CubicPolynomialPiecewise16 calldata f
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _createPodOrderPiecewise16(beanAmount, pricePerPod, maxPlaceInLine, f);
    }

    function create64PiecesDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.From mode,
        LibDynamic.CubicPolynomialPiecewise64 calldata f
    ) external payable returns (bytes32 id) {
        beanAmount = LibTransfer.receiveToken(C.bean(), beanAmount, msg.sender, mode);
        return _createPodOrderPiecewise64(beanAmount, pricePerPod, maxPlaceInLine, f);
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

    function fillPodOrderPiecewise4(
        PodOrder calldata o,
        LibDynamic.CubicPolynomialPiecewise4 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fillPodOrderPiecewise4(o, f, index, start, amount, mode);
    }

    function fillPodOrderPiecewise16(
        PodOrder calldata o,
        LibDynamic.CubicPolynomialPiecewise16 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fillPodOrderPiecewise16(o, f, index, start, amount, mode);
    }

    function fill64PiecesDynamicPodOrder(
        PodOrder calldata o,
        LibDynamic.CubicPolynomialPiecewise64 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) external payable {
        _fillPodOrderPiecewise64(o, f, index, start, amount, mode);
    }

    // Cancel
    function cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode
    ) external payable {
        _cancelPodOrder(pricePerPod, maxPlaceInLine, mode);
    }

    function cancelPodOrderPiecewise4(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise4 calldata f
    ) external payable {
        _cancelPodOrderPiecewise4(pricePerPod, maxPlaceInLine, mode, f);
    }

    function cancelPodOrderPiecewise16(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise16 calldata f
    ) external payable {
        _cancelPodOrderPiecewise16(pricePerPod, maxPlaceInLine, mode, f);
    }

    function cancel64PiecesDynamicPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise64 calldata f
    ) external payable {
        _cancelPodOrderPiecewise64(pricePerPod, maxPlaceInLine, mode, f);
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

    function podOrderPiecewise4(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibDynamic.CubicPolynomialPiecewise4 calldata f
    ) external view returns (uint256) {
        return s.podOrders[
            createOrderIdPiecewise4(
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

    function podOrderPiecewise16(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibDynamic.CubicPolynomialPiecewise16 calldata f
    ) external view returns (uint256) {
        return s.podOrders[
            createOrderIdPiecewise16(
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

    function podOrderPiecewise64(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibDynamic.CubicPolynomialPiecewise64 calldata f
    ) external view returns (uint256) {
        return s.podOrders[
            createOrderIdPiecewise64(
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
