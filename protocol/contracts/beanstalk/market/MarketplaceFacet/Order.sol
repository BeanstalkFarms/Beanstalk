/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Listing.sol";

/**
 * @author Beanjoyer, Malteasy
 * @title Pod Marketplace v2
 **/

contract Order is Listing {

    using SafeMath for uint256;

    struct PodOrder {
        address account;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        uint256 minFillAmount;
    }

    event PodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes pricingFunction,
        LibPolynomial.PriceType priceType
    );

    event PodOrderFilled(
        address indexed from,
        address indexed to,
        bytes32 id,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 costInBeans
    );

    event PodOrderCancelled(address indexed account, bytes32 id);

    /*
    * Create
    */
    // Note: Orders changed and now can accept an arbitary amount of beans, possibly higher than the value of the order
    /* Note: Fixed pod orders store at s.podOrders[id] the amount of pods that they order 
    * whereas dynamic orders store the amount of beans used to make the order 
    */
    function _createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, minFillAmount);

        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, minFillAmount, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        bytes memory emptyPricingFunction;
        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, minFillAmount, emptyPricingFunction, LibPolynomial.PriceType.Fixed);
    }

    function _createPodOrderV2(
        uint256 beanAmount,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes calldata pricingFunction
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderIdV2(msg.sender, 0, maxPlaceInLine, minFillAmount, pricingFunction);
        if (s.podOrders[id] > 0) _cancelPodOrderV2(maxPlaceInLine, minFillAmount, pricingFunction, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        emit PodOrderCreated(msg.sender, id, beanAmount, 0, maxPlaceInLine, minFillAmount, pricingFunction, LibPolynomial.PriceType.Dynamic);
    }


    /*
     * Fill
     */
    function _fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) internal {

        require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");
        require(s.a[msg.sender].field.plots[index] >= (start.add(amount)), "Marketplace: Invalid Plot.");
        require(index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.minFillAmount);
        uint256 costInBeans = amount.mul(o.pricePerPod).div(1000000);
        s.podOrders[id] = s.podOrders[id].sub(costInBeans, "Marketplace: Not enough beans in order.");

        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount, costInBeans);
    }

    function _fillPodOrderV2(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal {

        require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");
        require(s.a[msg.sender].field.plots[index] >= (start.add(amount)), "Marketplace: Invalid Plot.");
        require(index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createOrderIdV2(o.account, 0, o.maxPlaceInLine, o.minFillAmount, pricingFunction);
        uint256 costInBeans = getAmountBeansToFillOrderV2(index.add(start).sub(s.f.harvestable), amount, pricingFunction);
        s.podOrders[id] = s.podOrders[id].sub(costInBeans, "Marketplace: Not enough beans in order.");
        
        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount, costInBeans);
    }

    /*
     * Cancel
     */
    function _cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        LibTransfer.To mode
    ) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, minFillAmount);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelPodOrderV2(
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal {
        bytes32 id = createOrderIdV2(msg.sender, 0, maxPlaceInLine, minFillAmount, pricingFunction);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        
        emit PodOrderCancelled(msg.sender, id);
    }

    /*
    * PRICING
    */


    /**
        Consider a piecewise with the following breakpoints: [b0, b1, b2, b3, b4]
        Let us say the start  of our integration falls in the range [b0, b1], and the end of our integration falls in the range [b3, b4].
        Then our integration splits into: I(start, b1) + I(b1, b2) + I(b2, b3) + I(b3, end).
    */
    /**
    * @notice Calculates the amount of beans needed to fill an order.
    * @dev Integration over a range that falls within piecewise domain.
    */
    function getAmountBeansToFillOrderV2(
        uint256 placeInLine, 
        uint256 amountPodsFromOrder,
        bytes calldata pricingFunction
    ) public pure returns (uint256 beanAmount) { 
        beanAmount = LibPolynomial.evaluatePolynomialIntegrationPiecewise(pricingFunction, placeInLine, placeInLine.add(amountPodsFromOrder));
        beanAmount = beanAmount.div(1000000);
    }

    /*
     * Helpers
     */
     function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    ) internal pure returns (bytes32 id) {
        if(minFillAmount > 0) id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount));
        else id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));
    }

    function createOrderIdV2(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes calldata pricingFunction
    ) internal pure returns (bytes32 id) {
        require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount, pricingFunction));
    }
}
