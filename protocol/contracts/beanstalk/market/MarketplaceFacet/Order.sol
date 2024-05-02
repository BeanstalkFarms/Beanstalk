/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "./Listing.sol";

/**
 * @author Beanjoyer, Malteasy
 **/

contract Order is Listing {
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

        id = createOrderId(LibTractor._user(), pricePerPod, maxPlaceInLine, minFillAmount);

        if (s.podOrders[id] > 0)
            _cancelPodOrder(pricePerPod, maxPlaceInLine, minFillAmount, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        bytes memory emptyPricingFunction;
        emit PodOrderCreated(
            LibTractor._user(),
            id,
            beanAmount,
            pricePerPod,
            maxPlaceInLine,
            minFillAmount,
            emptyPricingFunction,
            LibPolynomial.PriceType.Fixed
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
        LibTransfer.To mode
    ) internal {
        require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");
        require(
            s.a[LibTractor._user()].field.plots[index] >= (start + amount),
            "Marketplace: Invalid Plot."
        );
        require(
            index + start + amount - s.f.harvestable <= o.maxPlaceInLine,
            "Marketplace: Plot too far in line."
        );

        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.minFillAmount);
        uint256 costInBeans = (amount * o.pricePerPod) / 1000000;
        require(s.podOrders[id] >= costInBeans, "Marketplace: Not enough beans in order.");
        s.podOrders[id] = s.podOrders[id] - costInBeans

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
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        LibTransfer.To mode
    ) internal {
        bytes32 id = createOrderId(LibTractor._user(), pricePerPod, maxPlaceInLine, minFillAmount);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, LibTractor._user(), mode);
        delete s.podOrders[id];
        emit PodOrderCancelled(LibTractor._user(), id);
    }

    /*
     * PRICING
     */

    /*
     * Helpers
     */
    function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    ) internal pure returns (bytes32 id) {
        if (minFillAmount > 0)
            id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount));
        else id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));
    }
}
