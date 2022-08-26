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
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
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
        uint256[16] polynomialBreakpoints,
        uint256[64] polynomialConstants,
        uint256[2] packedPolynomialBases,
        uint256 packedPolynomialSigns
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
    /* Note: Fixed pod orders store at s.podOrders[id] the amount of pods that they order 
    * whereas dynamic orders store the amount of beans used to make the order 
    */
    function _createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);

        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL);
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        s.podOrders[id] = amount;
        emit PodOrderCreated(msg.sender, id, amount, pricePerPod, maxPlaceInLine);
    }

    function _createDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PiecewisePolynomial calldata f
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        id = createDynamicOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        if (s.podOrders[id] > 0) _cancelDynamicPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        // Note: Orders changed to accept an arbitary amount of beans, higher than the value of the order
        (uint256[16] memory polynomialBreakpoints, uint256[64] memory polynomialSignificands) = loadArraysToMemory(f.breakpoints, f.significands);
        emit DynamicPodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, polynomialBreakpoints, polynomialSignificands, f.packedExponents, f.packedSigns);
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

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((index + start - s.f.harvestable + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine);
        s.podOrders[id] = s.podOrders[id].sub(amount, "Marketplace: Not enough pods in order.");
        uint256 costInBeans = amount.mul(o.pricePerPod).div(1000000);

        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount);
    }

    function _fillDynamicPodOrder(
        PodOrder calldata o,
        PiecewisePolynomial calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) internal {

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((index + start - s.f.harvestable + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createDynamicOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        uint256 costInBeans = getAmountBeansToFillDynamicOrder(f, index + start - s.f.harvestable, amount);
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
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);
        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelDynamicPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        PiecewisePolynomial calldata f
    ) internal {
        bytes32 id = createDynamicOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
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
    function getAmountBeansToFillDynamicOrder(
        PiecewisePolynomial calldata f,
        uint256 placeInLine, 
        uint256 amountPodsFromOrder
    ) internal pure returns (uint256 beanAmount) { 

        uint256 numIntervals = getNumPieces(f.breakpoints);
        uint256 pieceIndex = findPieceIndex(f.breakpoints, placeInLine, numIntervals - 1);
        uint256 start = placeInLine;
        uint256 end = placeInLine + amountPodsFromOrder;

        if(start < f.breakpoints[0]) start = f.breakpoints[0]; //limit the start of the integration to the start of the function domain

        while(start < end) {
            //if on the last piece, complete the remainder of the integration in the current piece
            if(pieceIndex != numIntervals - 1) {
                //if the integration reaches into the next piece, then break the integration at the end of the current piece
                if(end > f.breakpoints[pieceIndex + 1]) {
                    //current end index reaches into next piecewise domain
                    beanAmount +=  evaluatePolynomialIntegration(f, start, f.breakpoints[pieceIndex + 1], pieceIndex);
                    start = f.breakpoints[pieceIndex + 1]; // set place in line to the end index
                    if(pieceIndex < (numIntervals - 1)) pieceIndex++; //increment piece index if not at the last piece
                } else {
                    
                    beanAmount += evaluatePolynomialIntegration(f, start, end, pieceIndex);
                    start = end;
                }
            } else {
                beanAmount += evaluatePolynomialIntegration(f, start, end, pieceIndex);
                start = end;
            }
            
        }

        return beanAmount / 1000000;
    }

    /*
     * Helpers
     */
     function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));
    }

    function createDynamicOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256[16] calldata breakpoints,
        uint256[64] calldata constants,
        uint256[2] calldata packedExponents,
        uint256 packedSigns
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, breakpoints, constants, packedExponents, packedSigns));
    }
}
