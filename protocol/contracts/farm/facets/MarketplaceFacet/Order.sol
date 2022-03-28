/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Listing.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/
contract Order is Listing {
    using SafeMath for uint256;

    struct Order {
        address account; //20
        uint24 pricePerPod; // formula constant
        uint256 maxPlaceInLine; //highest index that the order will buy
        bool constantPricing;
        MathFP.PiecewiseFormula f;
    }

    event PodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool constantPricing,
        uint256[10] subIntervalIndex,
        uint256[40] constants,
        uint8[40] shifts,
        bool[40] bools
    );

    event PodOrderFilled(
        address indexed from,
        address indexed to,
        bytes32 id,
        uint256 index,
        uint256 start,
        uint256 amount
    );

    event PodOrderCancelled(address indexed account, bytes32 id);

    /*
     * Create
     */

    function _buyBeansAndCreatePodOrder(
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal returns (bytes32 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(
            buyBeanAmount,
            address(this)
        );
        return
            _createPodOrder(
                beanAmount + boughtBeanAmount,
                pricePerPod,
                maxPlaceInLine,
                constantPricing,
                f
            );
    }

    function _createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal returns (bytes32 id) {
        require(
            0 < pricePerPod,
            "Marketplace: Pod price must be greater than 0."
        );
        //amount is the definite integral over the whole range
        uint256 amountPods;
        if (constantPricing) {
            amountPods = (beanAmount * 1000000) / pricePerPod;
        } else {
            amountPods = _integrateCubic(
                f,
                f.subIntervalIndex[f.subIntervalIndex.length - 1],
                0,
                f.subIntervalIndex.length - 1
            );
        }
        return
            __createPodOrder(
                amountPods,
                pricePerPod,
                maxPlaceInLine,
                constantPricing,
                f
            );
    }

    function __createPodOrder(
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal returns (bytes32 id) {
        //uint is always > 0 -> unneccesary require?
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderId(
            msg.sender,
            pricePerPod,
            maxPlaceInLine,
            constantPricing,
            f.subIntervalIndex,
            f.constants,
            f.shifts,
            f.bools
        );
        if (s.podOrders[id] > 0)
            _cancelPodOrder(
                pricePerPod,
                maxPlaceInLine,
                false,
                constantPricing,
                f
            );
        s.podOrders[id] = amount;
        emit PodOrderCreated(
            msg.sender,
            id,
            amount,
            pricePerPod,
            maxPlaceInLine,
            constantPricing,
            f.subIntervalIndex,
            f.constants,
            f.shifts,
            f.bools
        );
        return id;
    }

    /*
     * Fill
     */

    function _fillPodOrder(
        Order calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        bool toWallet
    ) internal {
        bytes32 id = createOrderId(
            o.account,
            o.pricePerPod,
            o.maxPlaceInLine,
            o.constantPricing,
            o.f.subIntervalIndex,
            o.f.constants,
            o.f.shifts,
            o.f.bools
        );
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(
            s.a[msg.sender].field.plots[index] >= (start + amount),
            "Marketplace: Invalid Plot."
        );
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(
            placeInLineEndPlot <= o.maxPlaceInLine,
            "Marketplace: Plot too far in line."
        );

        // place in line for start of the listing
        uint256 placeInLine = index + start - s.f.harvestable;

        //cost in beans
        // uint256 costInBeans = (o.pricePerPod * amount) / 1000000;
        uint256 amountBeans;

        if (o.constantPricing) {
            amountBeans = (o.pricePerPod * amount) / 1000000;
        } else {
            uint256 startIndex = MathFP.findIndexWithinSubinterval(
                o.f.subIntervalIndex,
                placeInLine
            );
            uint256 endIndex = MathFP.findIndexWithinSubinterval(
                o.f.subIntervalIndex,
                placeInLineEndPlot
            );
            amountBeans = _integrateCubic(o.f, amount, startIndex, endIndex);
            // if (startIndex == endIndex) {
            //     //if both are in the same piecewise domain, then we only need to integrate one cubic
            //     amountBeans += _integrateCubic(
            //         [o.f.bools[startIndex],
            //         o.f.bools[startIndex + 10],
            //         o.f.bools[startIndex + 20],
            //         o.f.bools[startIndex + 30]],
            //         [o.f.shifts[startIndex],
            //         o.f.shifts[startIndex + 10],
            //         o.f.shifts[startIndex + 20],
            //         o.f.shifts[startIndex + 30]],
            //         [o.f.constants[startIndex],
            //         o.f.constants[startIndex + 10],
            //         o.f.constants[startIndex + 20],
            //         o.f.constants[startIndex + 30]],
            //         amount
            //     );
            // } else if (endIndex > startIndex) {
            //     //if the amount falls into more than one piecewise domain, we need to integrate them seperately

            //     //integrate the last cubic in the piecewise
            //     amountBeans += _integrateCubic(
            //         [o.f.bools[endIndex],
            //         o.f.bools[endIndex + 10],
            //         o.f.bools[endIndex + 20],
            //         o.f.bools[endIndex + 30]],
            //         [o.f.shifts[endIndex],
            //         o.f.shifts[endIndex + 10],
            //         o.f.shifts[endIndex + 20],
            //         o.f.shifts[endIndex + 30]],
            //         [o.f.constants[endIndex],
            //         o.f.constants[endIndex + 10],
            //         o.f.constants[endIndex + 20],
            //         o.f.constants[endIndex + 30]],
            //         amount - o.f.subIntervalIndex[endIndex]
            //     );

            //     //integrate the other (middle) ranges in the piecewise, if applicable
            //     if (endIndex > (startIndex + 1)) {
            //         for (uint8 i = 1; i <= (endIndex - startIndex - 1); i++) {
            //             amountBeans += _integrateCubic(
            //                 [o.f.bools[startIndex + i],
            //                 o.f.bools[startIndex + i + 10],
            //                 o.f.bools[startIndex + i + 20],
            //                 o.f.bools[startIndex + i + 30]],
            //                 [o.f.shifts[startIndex + i],
            //                 o.f.shifts[startIndex + i + 10],
            //                 o.f.shifts[startIndex + i + 20],
            //                 o.f.shifts[startIndex + i + 30]],
            //                 [o.f.constants[startIndex + i],
            //                 o.f.constants[startIndex + i + 10],
            //                 o.f.constants[startIndex + i + 20],
            //                 o.f.constants[startIndex + i + 30]],
            //                 o.f.subIntervalIndex[startIndex + i + 1] -
            //                     o.f.subIntervalIndex[startIndex + i]
            //             );
            //         }
            //     }
            // }
            amountBeans = amountBeans / 1000000;
        }

        // costInBeans = (pricePerPod * amount) / 1000000;

        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else
            s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(
                amountBeans
            );
        if (s.podListings[index] != bytes32(0)) {
            _cancelPodListing(index);
        }
        _transferPlot(msg.sender, o.account, index, start, amount);
        if (s.podOrders[id] == 0) {
            delete s.podOrders[id];
        }
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount);
    }

    /*
     * Cancel
     */

    function _cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool toWallet,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal {
        bytes32 id = createOrderId(
            msg.sender,
            pricePerPod,
            maxPlaceInLine,
            constantPricing,
            f.subIntervalIndex,
            f.constants,
            f.shifts,
            f.bools
        );
        //revisit
        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else
            s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(
                amountBeans
            );
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
    }

    /*
     * Helpers
     */

    function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool constantPricing,
        uint256[10] memory subIntervalIndex,
        uint256[40] memory constants,
        uint8[40] memory shifts,
        bool[40] memory bools
    ) internal pure returns (bytes32 id) {
        id = keccak256(
            abi.encodePacked(
                account,
                pricePerPod,
                maxPlaceInLine,
                constantPricing,
                subIntervalIndex,
                constants,
                shifts,
                bools
            )
        );
    }
}
