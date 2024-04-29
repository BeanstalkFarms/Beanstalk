/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Listing.sol";

/**
 * @author Beanjoyer, Malteasy
 * @title Pod Marketplace
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
    // Note: Orders can accept an arbitary amount of beans, possibly higher than the value of the order
    /* Note: Fixed pod orders store at s.podOrders[id] the amount of pods that they order
     * whereas dynamic orders store the amount of beans used to make the order
     */
    function _createPodOrder(
        uint256 beanAmount,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes calldata pricingFunction
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderId(LibTractor._user(), 0, maxPlaceInLine, minFillAmount, pricingFunction);
        if (s.podOrders[id] > 0)
            _cancelPodOrder(
                maxPlaceInLine,
                minFillAmount,
                pricingFunction,
                LibTransfer.To.INTERNAL
            );
        s.podOrders[id] = beanAmount;

        emit PodOrderCreated(
            LibTractor._user(),
            id,
            beanAmount,
            0,
            maxPlaceInLine,
            minFillAmount,
            pricingFunction,
            LibPolynomial.PriceType.Dynamic
        );
    }

    /*
     * Fill
     */

    function _fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal {
        require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");
        require(
            s.a[LibTractor._user()].field.plots[index] >= (start.add(amount)),
            "Marketplace: Invalid Plot."
        );
        require(
            index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine,
            "Marketplace: Plot too far in line."
        );

        bytes32 id = createOrderId(
            o.account,
            0,
            o.maxPlaceInLine,
            o.minFillAmount,
            pricingFunction
        );
        uint256 costInBeans = getAmountBeansToFillOrder(
            index.add(start).sub(s.f.harvestable),
            amount,
            pricingFunction
        );
        s.podOrders[id] = s.podOrders[id].sub(
            costInBeans,
            "Marketplace: Not enough beans in order."
        );

        LibTransfer.sendToken(C.bean(), costInBeans, LibTractor._user(), mode);

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(LibTractor._user(), index);

        _transferPlot(LibTractor._user(), o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];

        emit PodOrderFilled(LibTractor._user(), o.account, id, index, start, amount, costInBeans);
    }

    /*
     * Cancel
     */

    function _cancelPodOrder(
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal {
        bytes32 id = createOrderId(
            LibTractor._user(),
            0,
            maxPlaceInLine,
            minFillAmount,
            pricingFunction
        );
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, LibTractor._user(), mode);
        delete s.podOrders[id];

        emit PodOrderCancelled(LibTractor._user(), id);
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
    function getAmountBeansToFillOrder(
        uint256 placeInLine,
        uint256 amountPodsFromOrder,
        bytes calldata pricingFunction
    ) public pure returns (uint256 beanAmount) {
        beanAmount = LibPolynomial.evaluatePolynomialIntegrationPiecewise(
            pricingFunction,
            placeInLine,
            placeInLine.add(amountPodsFromOrder)
        );
        beanAmount = beanAmount.div(1000000);
    }

    /*
     * Helpers
     */

    function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes calldata pricingFunction
    ) internal pure returns (bytes32 id) {
        require(
            pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32),
            "Marketplace: Invalid pricing function."
        );
        id = keccak256(
            abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount, pricingFunction)
        );
    }
}
