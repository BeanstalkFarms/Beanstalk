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
        uint256 maxPlaceInLine,
        LibDynamic.PriceType priceType
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
        uint256 maxPlaceInLine
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);

        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;
        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, LibDynamic.PriceType.Fixed);
    }

    function _createPodOrderPiecewise4(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibDynamic.CubicPolynomialPiecewise4 calldata f
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderIdPiecewise4(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        if (s.podOrders[id] > 0) _cancelPodOrderPiecewise4(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, LibDynamic.PriceType.Piecewise4);
        emit NewCubicPolynomialPiecewise4(f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
    }

    function _createPodOrderPiecewise16(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibDynamic.CubicPolynomialPiecewise16 calldata f
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderIdPiecewise16(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        if (s.podOrders[id] > 0) _cancelPodOrderPiecewise16(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, LibDynamic.PriceType.Piecewise16);
        emit NewCubicPolynomialPiecewise16(f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
    }

    function _createPodOrderPiecewise64(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibDynamic.CubicPolynomialPiecewise64 calldata f
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderIdPiecewise64(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        if (s.podOrders[id] > 0) _cancelPodOrderPiecewise64(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, LibDynamic.PriceType.Piecewise64);
        emit NewCubicPolynomialPiecewise64(f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
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
        uint256 costInBeans = amount.mul(o.pricePerPod).div(1000000);
        s.podOrders[id] = s.podOrders[id].sub(costInBeans, "Marketplace: Not enough beans in order.");

        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount, costInBeans);
    }

    function _fillPodOrderPiecewise4(
        PodOrder calldata o,
        LibDynamic.CubicPolynomialPiecewise4 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) internal {

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((index + start - s.f.harvestable + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createOrderIdPiecewise4(o.account, o.pricePerPod, o.maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        uint256 costInBeans = getAmountBeansToFillOrderPiecewise4(f, index + start - s.f.harvestable, amount);
        s.podOrders[id] = s.podOrders[id].sub(costInBeans, "Marketplace: Not enough beans in order.");
        
        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount, costInBeans);
    }

    function _fillPodOrderPiecewise16(
        PodOrder calldata o,
        LibDynamic.CubicPolynomialPiecewise16 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) internal {

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((index + start - s.f.harvestable + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createOrderIdPiecewise16(o.account, o.pricePerPod, o.maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        uint256 costInBeans = getAmountBeansToFillOrderPiecewise16(f, index + start - s.f.harvestable, amount);
        s.podOrders[id] = s.podOrders[id].sub(costInBeans, "Marketplace: Not enough beans in order.");
        
        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount, costInBeans);
    }

    function _fillPodOrderPiecewise64(
        PodOrder calldata o,
        LibDynamic.CubicPolynomialPiecewise64 calldata f,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) internal {

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((index + start - s.f.harvestable + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        bytes32 id = createOrderIdPiecewise64(o.account, o.pricePerPod, o.maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        uint256 costInBeans = getAmountBeansToFillOrderPiecewise64(f, index + start - s.f.harvestable, amount);
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
        LibTransfer.To mode
    ) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelPodOrderPiecewise4(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise4 calldata f
    ) internal {
        bytes32 id = createOrderIdPiecewise4(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelPodOrderPiecewise16(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise16 calldata f
    ) internal {
        bytes32 id = createOrderIdPiecewise16(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        
        emit PodOrderCancelled(msg.sender, id);
    }

    function _cancelPodOrderPiecewise64(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode,
        LibDynamic.CubicPolynomialPiecewise64 calldata f
    ) internal {
        bytes32 id = createOrderIdPiecewise64(msg.sender, pricePerPod, maxPlaceInLine, f.breakpoints, f.significands, f.packedExponents, f.packedSigns);
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
    function getAmountBeansToFillOrderPiecewise4(
        LibDynamic.CubicPolynomialPiecewise4 calldata f,
        uint256 placeInLine, 
        uint256 amountPodsFromOrder
    ) public pure returns (uint256 beanAmount) { 

        uint256 piecewiseLength = LibDynamic.getLengthOfPiecewise4(f.breakpoints);
        uint256 pieceIndex = LibDynamic.findIndexPiecewise4(
            f.breakpoints, 
            placeInLine, 
            piecewiseLength - 1
        );

        uint256 start = placeInLine;
        uint256 end = placeInLine + amountPodsFromOrder;

        if(start < f.breakpoints[0]) start = f.breakpoints[0]; //limit the start of the integration to the start of the function domain

        while(start < (placeInLine + amountPodsFromOrder)) {
            //if on the last piece, complete the remainder of the integration in the current piece
            if(pieceIndex != piecewiseLength - 1) {
                //if the integration reaches into the next piece, then break the integration at the end of the current piece
                if(end > f.breakpoints[pieceIndex + 1]) {
                    //current end index reaches into next piecewise domain
                    beanAmount += LibDynamic.evaluatePolynomialIntegration(
                        [
                            f.significands[pieceIndex*4], 
                            f.significands[pieceIndex*4 + 1], 
                            f.significands[pieceIndex*4 + 2], 
                            f.significands[pieceIndex*4 + 3]
                        ], 
                        LibDynamic.getPackedExponents(f.packedExponents, pieceIndex), 
                        LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                        start - f.breakpoints[pieceIndex], 
                        f.breakpoints[pieceIndex + 1] - f.breakpoints[pieceIndex]
                    );
                    start = f.breakpoints[pieceIndex + 1]; // set place in line to the end index
                    if(pieceIndex < (piecewiseLength - 1)) pieceIndex++; //increment piece index if not at the last piece
                } else {
                    
                    beanAmount += LibDynamic.evaluatePolynomialIntegration(
                        [
                            f.significands[pieceIndex], 
                            f.significands[pieceIndex*4 + 1], 
                            f.significands[pieceIndex*4 + 2],
                            f.significands[pieceIndex*4 + 3]
                        ], 
                        LibDynamic.getPackedExponents(f.packedExponents, pieceIndex), 
                        LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                        start - f.breakpoints[pieceIndex], 
                        end - f.breakpoints[pieceIndex]
                    );
                    start = end;
                }
            } else {
                beanAmount += LibDynamic.evaluatePolynomialIntegration(
                    [
                        f.significands[pieceIndex], 
                        f.significands[pieceIndex*4 + 1], 
                        f.significands[pieceIndex*4 + 2],
                        f.significands[pieceIndex*4 + 3]
                    ], 
                    LibDynamic.getPackedExponents(f.packedExponents, pieceIndex), 
                    LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                    start - f.breakpoints[pieceIndex], 
                    end - f.breakpoints[pieceIndex]
                );
                start = end;
            }
            
        }

        return beanAmount / 1000000;
    }

    function getAmountBeansToFillOrderPiecewise16(
        LibDynamic.CubicPolynomialPiecewise16 calldata f,
        uint256 placeInLine, 
        uint256 amountPodsFromOrder
    ) public pure returns (uint256 beanAmount) { 

        uint256 piecewiseLength = LibDynamic.getLengthOfPiecewise16(f.breakpoints);
        uint256 pieceIndex = LibDynamic.findIndexPiecewise16(
            f.breakpoints, 
            placeInLine, 
            piecewiseLength - 1
        );

        uint256 start = placeInLine;
        uint256 end = placeInLine + amountPodsFromOrder;

        if(start < f.breakpoints[0]) start = f.breakpoints[0]; //limit the start of the integration to the start of the function domain

        while(start < end) {
            //if on the last piece, complete the remainder of the integration in the current piece
            if(pieceIndex != piecewiseLength - 1) {
                //if the integration reaches into the next piece, then break the integration at the end of the current piece
                if(end > f.breakpoints[pieceIndex + 1]) {
                    //current end index reaches into next piecewise domain
                    beanAmount +=  LibDynamic.evaluatePolynomialIntegration(
                        [
                            f.significands[pieceIndex*4], 
                            f.significands[pieceIndex*4 + 1], 
                            f.significands[pieceIndex*4 + 2], 
                            f.significands[pieceIndex*4 + 3]
                        ], 
                        LibDynamic.getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex), 
                        LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                        start - f.breakpoints[pieceIndex], 
                        f.breakpoints[pieceIndex + 1] - f.breakpoints[pieceIndex]
                    );

                    start = f.breakpoints[pieceIndex + 1]; // set place in line to the end index
                    if(pieceIndex < (piecewiseLength - 1)) pieceIndex++; //increment piece index if not at the last piece
                } else {
                    
                    beanAmount += LibDynamic.evaluatePolynomialIntegration(
                        [
                            f.significands[pieceIndex*4], 
                            f.significands[pieceIndex*4 + 1], 
                            f.significands[pieceIndex*4 + 2], 
                            f.significands[pieceIndex*4 + 3]
                        ], 
                        LibDynamic.getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex), 
                        LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                        start - f.breakpoints[pieceIndex], 
                        end - f.breakpoints[pieceIndex]
                    );

                    start = end;
                }
            } else {
                beanAmount += LibDynamic.evaluatePolynomialIntegration(
                    [
                        f.significands[pieceIndex*4], 
                        f.significands[pieceIndex*4 + 1], 
                        f.significands[pieceIndex*4 + 2], 
                        f.significands[pieceIndex*4 + 3]
                    ], 
                    LibDynamic.getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex), 
                    LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                    start - f.breakpoints[pieceIndex], 
                    end - f.breakpoints[pieceIndex]
                );

                start = end;
            }
            
        }

        return beanAmount / 1000000;
    }

    function getAmountBeansToFillOrderPiecewise64(
        LibDynamic.CubicPolynomialPiecewise64 calldata f,
        uint256 placeInLine, 
        uint256 amountPodsFromOrder
    ) public pure returns (uint256 beanAmount) { 

        uint256 piecewiseLength = LibDynamic.getLengthOfPiecewise64(f.breakpoints);
        uint256 pieceIndex = LibDynamic.findIndexPiecewise64(
            f.breakpoints, 
            placeInLine, 
            piecewiseLength - 1
        );

        uint256 start = placeInLine;
        uint256 end = placeInLine + amountPodsFromOrder;

        if(start < f.breakpoints[0]) start = f.breakpoints[0]; //limit the start of the integration to the start of the function domain

        while(start < end) {
            //if on the last piece, complete the remainder of the integration in the current piece
            if(pieceIndex != piecewiseLength - 1) {
                //if the integration reaches into the next piece, then break the integration at the end of the current piece
                if(end > f.breakpoints[pieceIndex + 1]) {
                    //current end index reaches into next piecewise domain
                    beanAmount +=  LibDynamic.evaluatePolynomialIntegration(
                        [
                            f.significands[pieceIndex*4], 
                            f.significands[pieceIndex*4 + 1], 
                            f.significands[pieceIndex*4 + 2], 
                            f.significands[pieceIndex*4 + 3]
                        ], 
                        LibDynamic.getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex), 
                        LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                        start - f.breakpoints[pieceIndex], 
                        f.breakpoints[pieceIndex + 1] - f.breakpoints[pieceIndex]
                    );
                    start = f.breakpoints[pieceIndex + 1]; // set place in line to the end index
                    if(pieceIndex < (piecewiseLength - 1)) pieceIndex++; //increment piece index if not at the last piece
                } else {
                    
                    beanAmount += LibDynamic.evaluatePolynomialIntegration(
                        [
                            f.significands[pieceIndex*4], 
                            f.significands[pieceIndex*4 + 1], 
                            f.significands[pieceIndex*4 + 2], 
                            f.significands[pieceIndex*4 + 3]
                        ], 
                        LibDynamic.getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex), 
                        LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                        start - f.breakpoints[pieceIndex], 
                        end - f.breakpoints[pieceIndex]
                    );
                    start = end;
                }
            } else {
                beanAmount += LibDynamic.evaluatePolynomialIntegration(
                    [
                        f.significands[pieceIndex*4], 
                        f.significands[pieceIndex*4 + 1], 
                        f.significands[pieceIndex*4 + 2], 
                        f.significands[pieceIndex*4 + 3]
                    ], 
                    LibDynamic.getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex), 
                    LibDynamic.getPackedSigns(f.packedSigns, pieceIndex), 
                    start - f.breakpoints[pieceIndex], 
                    end - f.breakpoints[pieceIndex]
                );
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

    function createOrderIdPiecewise4(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256[4] calldata breakpoints,
        uint256[16] calldata significands,
        uint256 packedExponents,
        uint256 packedSigns
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, breakpoints, significands, packedExponents, packedSigns));
    }

    function createOrderIdPiecewise16(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256[16] calldata breakpoints,
        uint256[64] calldata significands,
        uint256[2] calldata packedExponents,
        uint256 packedSigns
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, breakpoints, significands, packedExponents, packedSigns));
    }

    function createOrderIdPiecewise64(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256[64] calldata breakpoints,
        uint256[256] calldata significands,
        uint256[8] calldata packedExponents,
        uint256 packedSigns
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, breakpoints, significands, packedExponents, packedSigns));
    }
}
