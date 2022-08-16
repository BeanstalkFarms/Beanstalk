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
        uint256[] ranges,
        uint256[] values,
        uint256[] bases,
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

    //Note: Gas here increased from ~97k to 175k
    function _createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

        (uint256[32] memory ranges, uint256[128] memory values, uint256[4] memory bases) = createZeros();

        id = createOrderIdMem(msg.sender, pricePerPod, maxPlaceInLine, PricingMode.CONSTANT, ranges, values, bases, 0);

        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        // Note: Orders changed to accept an arbitary amount of beans, higher than the value of the order
        
        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine);
    }

    //Note: Gas is quite high, ~460k
    function _createDynamicPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PPoly32 calldata f
    ) internal returns (bytes32 id) {
        console.log("_createDPodOrder");
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");
        console.log(gasleft());

        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.mode, f.ranges, f.values, f.bases, f.signs);
        console.log(gasleft());
        
        if (s.podOrders[id] > 0) _cancelDynamicPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        console.log(gasleft());
        // Note: Orders changed to accept an arbitary amount of beans, higher than the value of the order
        
        uint256[] memory ranges = new uint256[](32);
        uint256[] memory values = new uint256[](128);
        uint256[] memory bases = new uint256[](4);

        for(uint256 i = 0; i < 128; i++){
            values[i] = f.values[i];
            if(i < 4) bases[i] = f.bases[i];
            if(i < 32) ranges[i] = f.ranges[i];
        }

        console.log(gasleft());

        emit DynamicPodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, ranges, values, bases, f.signs);

        console.log(gasleft());        
    }

    /*
     * Fill
     */

    //Note: Gas is 199-225k
    function _fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        LibTransfer.To mode
    ) internal {
        console.log("_fillPodOrder");
        console.log(gasleft());

        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.f.mode, o.f.ranges, o.f.values, o.f.bases, o.f.signs);
        console.log(gasleft());
        
        uint256 placeInLine = index + start - s.f.harvestable;

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((placeInLine + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
        
        console.log(gasleft());

        uint256 costInBeans;
        if(o.f.mode == PricingMode.CONSTANT){
            costInBeans = amount.mul(o.pricePerPod).div(1000000);
        } else {
            costInBeans = getDynamicOrderAmount(o.f, placeInLine, amount);
        }

        console.log(gasleft());
        
        s.podOrders[id] = s.podOrders[id].sub(costInBeans);
        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        console.log(gasleft());
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);
        console.log(gasleft());

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount);
        console.log(gasleft());

    }

    /*
     * Cancel
     */


     //Note: the gas costs for this function are ~125k, compared to ~48k from before, which is a significant increase.
     function _cancelPodOrder(
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        LibTransfer.To mode
    ) internal {
        (uint256[32] memory ranges, uint256[128] memory values, uint256[4] memory bases) = createZeros();
        bytes32 id = createOrderIdMem(msg.sender, pricePerPod, maxPlaceInLine, PricingMode.CONSTANT, ranges, values, bases, 0);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        
        emit PodOrderCancelled(msg.sender, id);
    }

    //Note: Gas ~150k
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
    function getDynamicOrderAmount(
        PPoly32 calldata f,
        uint256 placeInLine, 
        uint256 amount
    ) internal view returns (uint256 beanAmount) { 

        uint256 pieceIndex;
        uint256 maxIndex = getMaxPieceIndex(f.ranges);

        require(placeInLine < f.ranges[maxIndex]);

        if(placeInLine > f.ranges[0]) {
            pieceIndex = findIndex(f.ranges, placeInLine, maxIndex);
            pieceIndex = pieceIndex > 0 ? pieceIndex - 1 : 0;
        }

        uint256 end = placeInLine + amount;

        while(placeInLine < end) { 

            uint256 degree = getDegree(f, pieceIndex);
            uint256 termValue;
            if(pieceIndex < maxIndex && end > f.ranges[pieceIndex+1]) {
                //current end index reaches into next piecewise domain
                beanAmount += evaluatePPolyI(f, placeInLine, f.ranges[pieceIndex+1], pieceIndex, degree);
                placeInLine = f.ranges[pieceIndex+1]; // set place in line to the end index
                if(pieceIndex < maxIndex) pieceIndex++;
            
            } else {
                beanAmount += evaluatePPolyI(f, placeInLine, end, pieceIndex, degree);
                placeInLine = end;
            }
        }
        return beanAmount / 1000000;
    }

    /*
     * Helpers
     */
     function createOrderIdMem(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PricingMode priceMode,
        uint256[32] memory ranges,
        uint256[128] memory values,
        uint256[4] memory bases,
        uint256 signs
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, priceMode == PricingMode.CONSTANT, ranges, values, bases, signs));
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
