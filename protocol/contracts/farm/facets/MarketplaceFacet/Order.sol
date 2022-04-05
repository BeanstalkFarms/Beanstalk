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
        address account;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
    }

    struct DynamicOrder {
        address account;
        uint256 maxPlaceInLine;
        PiecewiseCubic f;
    }

    event PodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    );

    event DynamicPodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint256 maxPlaceInLine,
        uint256[10] subIntervalIndex,
        uint256[40] constants,
        uint8[40] shifts,
        bool[40] signs
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

    event OrderFill(uint256 amount);

    /*
     * Create
     */

    function _buyBeansAndCreatePodOrder(uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod, uint256 maxPlaceInLine) internal returns (bytes32 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount + boughtBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function _buyBeansAndCreateDynamicPodOrder(uint256 beanAmount, uint256 buyBeanAmount, uint256 maxPlaceInLine, PiecewiseCubic calldata f) internal returns (bytes32 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createDynamicPodOrder(beanAmount + boughtBeanAmount, maxPlaceInLine, f);
    }

    function _createPodOrder(uint256 beanAmount, uint24 pricePerPod, uint256 maxPlaceInLine) internal returns (bytes32 id) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");

        uint256 amountPods = (beanAmount * 1000000) / pricePerPod;

        return __createPodOrder(amountPods, pricePerPod, maxPlaceInLine);
    }

    function _createDynamicPodOrder(uint256 beanAmount, uint256 maxPlaceInLine, PiecewiseCubic calldata f) internal returns (bytes32 id) {
        require(0 < beanAmount, "Marketplace: Pod price must be greater than 0.");

        uint256 amountPods = _getSumOverPiecewiseRange(f, f.subIntervalIndex[0], beanAmount);

        emit OrderFill(amountPods);

        return __createDynamicPodOrder(amountPods, maxPlaceInLine, f);
    }

    function __createPodOrder(uint256 amount, uint24 pricePerPod, uint256 maxPlaceInLine) internal returns (bytes32 id) {
        //uint is always > 0 -> unneccesary require?
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);
        if (s.podOrders[id] > 0)
            _cancelPodOrder(pricePerPod, maxPlaceInLine, false);
        s.podOrders[id] = amount;
        emit PodOrderCreated(
            msg.sender,
            id,
            amount,
            pricePerPod,
            maxPlaceInLine
        );
        return id;
    }

    function __createDynamicPodOrder(uint256 amount, uint256 maxPlaceInLine, PiecewiseCubic calldata f) internal returns (bytes32 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        id = createDynamicOrderId(msg.sender, maxPlaceInLine, f.subIntervalIndex, f.constants, f.shifts, f.signs);
        if (s.podOrders[id] > 0)
            _cancelDynamicPodOrder(maxPlaceInLine, false, f);
        s.podOrders[id] = amount;
        emit DynamicPodOrderCreated(
            msg.sender,
            id,
            amount,
            maxPlaceInLine,
            f.subIntervalIndex,
            f.constants,
            f.shifts,
            f.signs
        );
        return id;
    }

    /*
     * Fill
     */

    function _fillPodOrder(Order calldata o, uint256 index, uint256 start, uint256 amount, bool toWallet) internal {
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine);

        s.podOrders[id] = s.podOrders[id].sub(amount);

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");

        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;

        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        uint256 placeInLine = index + start - s.f.harvestable;

        uint256 amountBeans = (o.pricePerPod * amount) / 1000000;

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

    function _fillDynamicPodOrder(DynamicOrder calldata o, uint256 index, uint256 start, uint256 amount, bool toWallet) internal {
        bytes32 id = createDynamicOrderId(o.account, o.maxPlaceInLine, o.f.subIntervalIndex, o.f.constants, o.f.shifts, o.f.signs);
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        uint256 placeInLine = index + start - s.f.harvestable;

        uint256 amountBeans = _getSumOverPiecewiseRange(o.f, placeInLine, amount) / 1000000;

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

    function _cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, bool toWallet) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);

        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else
            s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(
                amountBeans
            );
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelDynamicPodOrder(uint256 maxPlaceInLine, bool toWallet, PiecewiseCubic calldata f) internal {
        bytes32 id = createDynamicOrderId(msg.sender, maxPlaceInLine, f.subIntervalIndex, f.constants, f.shifts, f.signs);

        uint256 amountBeans = _getSumOverPiecewiseRange(f, f.subIntervalIndex[0], f.subIntervalIndex[f.subIntervalIndex.length]);
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

    function _getSumOverPiecewiseRange(PiecewiseCubic calldata f, uint256 x, uint256 amount) internal pure returns (uint256) {
        uint256 startIndex = _findIndex(f.subIntervalIndex, x);
        uint256 endIndex = _findIndex(f.subIntervalIndex, x + amount);
        //if x+amount is less than the end of the subinterval is in, there is only a need to evaluate one function integration
        //i think these need to be fixed 
        if (x + amount < f.subIntervalIndex[startIndex + 1]) {
            return
            LibMathFP.evaluateCubic(
                    [f.signs[startIndex],
                    f.signs[startIndex + 10],
                    f.signs[startIndex + 20],
                    f.signs[startIndex + 30]],
                    [f.shifts[startIndex],
                    f.shifts[startIndex + 10],
                    f.shifts[startIndex + 20],
                    f.shifts[startIndex + 30]],
                    [f.constants[startIndex],
                    f.constants[startIndex + 10],
                    f.constants[startIndex + 20],
                    f.constants[startIndex + 30]],
                    amount,
                    true
                );
        } else {
            uint256 midSum;
            for (uint8 midIndex = 1; midIndex < (endIndex - startIndex - 1); midIndex++) {
                midSum += LibMathFP.evaluateCubic(
                    [f.signs[startIndex + midIndex],
                    f.signs[startIndex + midIndex + 10],
                    f.signs[startIndex + midIndex + 20],
                    f.signs[startIndex + midIndex + 30]],
                    [f.shifts[startIndex + midIndex],
                    f.shifts[startIndex + midIndex + 10],
                    f.shifts[startIndex + midIndex + 20],
                    f.shifts[startIndex + midIndex + 30]],
                    [f.constants[startIndex + midIndex],
                    f.constants[startIndex + midIndex + 10],
                    f.constants[startIndex + midIndex + 20],
                    f.constants[startIndex + midIndex + 30]],
                    f.subIntervalIndex[startIndex + midIndex + 1] -
                    f.subIntervalIndex[startIndex + midIndex],
                    true
                );
            }
            return LibMathFP.evaluateCubic(
                    [f.signs[startIndex],
                        f.signs[startIndex + 10],
                        f.signs[startIndex + 20],
                        f.signs[startIndex + 30]],
                    [f.shifts[startIndex],
                        f.shifts[startIndex + 10],
                        f.shifts[startIndex + 20],
                        f.shifts[startIndex + 30]],
                    [f.constants[startIndex],
                        f.constants[startIndex + 10],
                        f.constants[startIndex + 20],
                        f.constants[startIndex + 30]],
                    x - f.subIntervalIndex[startIndex],
                    true
                ) +
                midSum +
                LibMathFP.evaluateCubic(
                    [f.signs[endIndex],
                        f.signs[endIndex + 10],
                        f.signs[endIndex + 20],
                        f.signs[endIndex + 30]],
                    [f.shifts[endIndex],
                        f.shifts[endIndex + 10],
                        f.shifts[endIndex + 20],
                        f.shifts[endIndex + 30]],
                    [f.constants[endIndex],
                        f.constants[endIndex + 10],
                        f.constants[endIndex + 20],
                        f.constants[endIndex + 30]],
                    x + amount - f.subIntervalIndex[endIndex],
                    true
                );
        }
    }

    function createOrderId(address account, uint24 pricePerPod, uint256 maxPlaceInLine) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));
    }

    function createDynamicOrderId(address account, uint256 maxPlaceInLine, uint256[10] calldata subIntervalIndex, uint256[40] calldata constants, uint8[40] calldata shifts, bool[40] memory signs) internal pure returns (bytes32 id) {
        id = keccak256(
            abi.encodePacked(
                account,
                maxPlaceInLine,
                subIntervalIndex,
                constants,
                shifts,
                signs
            )
        );
    }
}
