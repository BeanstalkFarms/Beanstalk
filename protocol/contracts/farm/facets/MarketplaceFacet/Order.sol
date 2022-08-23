/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Listing.sol";
import "hardhat/console.sol";


/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/

contract Order is Listing {

    using SafeMath for uint256;

    struct PodOrder {
        address account;
        bytes32 id;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        PPoly32 f;
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
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
        uint256[32] ranges,
        uint256[128] values,
        uint256[4] bases,
        uint256 signs
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
    // Note: Orders changed and now can accept an arbitary amount of beans, possibly higher than the value of the order
    function _createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

        id = createOrderIdConstant(msg.sender, pricePerPod, maxPlaceInLine);

        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        
        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine);
    }

    function _createDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PPoly32 calldata f
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.mode, f.ranges, f.values, f.bases, f.signs);
        
        if (s.podOrders[id] > 0) _cancelDynamicPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        // Note: Orders changed to accept an arbitary amount of beans, higher than the value of the order
        
        PPoly32 memory _f = toMemory(f);

        emit DynamicPodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, _f.ranges, _f.values, _f.bases, _f.signs);
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

        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.f.mode, o.f.ranges, o.f.values, o.f.bases, o.f.signs);
        
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((index + start - s.f.harvestable + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        uint256 costInBeans;
        if(o.f.mode == PricingMode.CONSTANT)
            costInBeans = amount.mul(o.pricePerPod).div(1000000);
        else
            costInBeans = getDynamicOrderAmount(o.f, index + start - s.f.harvestable, amount);
        
        s.podOrders[id] = s.podOrders[id].sub(costInBeans, "Marketplace: Not enough beans in order.");
        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount);
    }

    /*
     * Cancel
     */
    function _cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode
    ) internal {
        bytes32 id = createOrderIdConstant(msg.sender, pricePerPod, maxPlaceInLine);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelDynamicPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        PPoly32 calldata f
    ) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.mode, f.ranges, f.values, f.bases, f.signs);
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
    function getDynamicOrderAmount(
        PPoly32 calldata f,
        uint256 placeInLine, 
        uint256 amount
    ) internal pure returns (uint256 beanAmount) { 

        uint256 numIntervals = getNumIntervals(f.ranges);

        uint256 pieceIndex = findIndex(f.ranges, placeInLine, numIntervals - 1);

        uint256 start = placeInLine;

        uint256 end = placeInLine + amount;

        if(start < f.ranges[0]) start = f.ranges[0]; //limit the start of the integration to the start of the function domain

        while(start < end) {
            //if on the last piece, complete the remainder of the integration in the current piece
            if(pieceIndex != numIntervals - 1) {
                //if the integration reaches into the next piece, then break the integration at the end of the current piece
                if(end > f.ranges[pieceIndex + 1]) {
                    //current end index reaches into next piecewise domain
                    beanAmount +=  evaluatePPolyI(f, start, f.ranges[pieceIndex + 1], pieceIndex);
                    start = f.ranges[pieceIndex + 1]; // set place in line to the end index
                    if(pieceIndex < (numIntervals - 1)) pieceIndex++; //increment piece index if not at the last piece
                } else {
                    
                    beanAmount += evaluatePPolyI(f, start, end, pieceIndex);
                    start = end;
                }
            } else {
                beanAmount += evaluatePPolyI(f, start, end, pieceIndex);
                start = end;
            }
            
        }

        return beanAmount / 1000000;
    }

    /*
     * Helpers
     */
     function createOrderIdConstant(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) internal pure returns (bytes32 id) {
        (uint256[32] memory ranges, uint256[128] memory values, uint256[4] memory bases) = createZeros();
        uint256 signs = 0;
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, true, ranges, values, bases, signs));
    }

    function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PricingMode priceMode,
        uint256[32] calldata ranges,
        uint256[128] calldata values,
        uint256[4] calldata bases,
        uint256 signs
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, priceMode == PricingMode.CONSTANT, ranges, values, bases, signs));
    }
}
