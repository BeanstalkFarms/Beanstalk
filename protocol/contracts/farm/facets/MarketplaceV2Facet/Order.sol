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

    // struct PodOrder {
    //     address account;
    //     bytes32 id;
    //     uint24 pricePerPod;
    //     uint256 maxPlaceInLine;
    //     PiecewiseFunction f;
    // }

    struct PodOrder {
        address account;
        bytes32 id;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        PackedPiecewiseFunction f;
    }

    event PodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    );

    // event DynamicPodOrderCreated(
    //     address indexed account,
    //     bytes32 id,
    //     uint256 amount,
    //     uint24 pricePerPod, 
    //     uint256 maxPlaceInLine,
    //     uint256[] values,
    //     uint8[] bases,
    //     bool[] signs
    // );

    event DynamicPodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
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

        // (uint256[numValues] memory values, uint8[numMeta] memory bases, bool[numMeta] memory signs) = createZeros();
        (uint256[numValues] memory values, uint256[indexMultiplier] memory bases, uint256 signs) = createZeros();

        id = createOrderIdMem(msg.sender, pricePerPod, maxPlaceInLine, PricingMode.CONSTANT, values, bases, signs);

        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL);
        s.podOrders[id] = beanAmount;

        // Note: Orders changed to accept an arbitary amount of beans, higher than the value of the order
        // emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, f.t);
        
        emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine);
    }

    //Note: Gas is quite high, ~460k
    function _createDPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        // PiecewiseFunction calldata f
        PackedPiecewiseFunction calldata f
    ) internal returns (bytes32 id) {
        require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.mode, f.values, f.bases, f.signs);
        
        if (s.podOrders[id] > 0) _cancelDynamicPodOrder(pricePerPod, maxPlaceInLine, LibTransfer.To.INTERNAL, f);
        s.podOrders[id] = beanAmount;

        // Note: Orders changed to accept an arbitary amount of beans, higher than the value of the order
        // emit PodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, f.t);
        
        //Note: make this into a new function
        uint256[] memory values = new uint256[](numValues);
        uint256[] memory bases = new uint256[](indexMultiplier);
        // uint8[] memory bases = new uint8[](numMeta);
        // bool[] memory signs = new bool[](numMeta);
        for(uint8 i = 0; i < numValues; i++){
            values[i] = f.values[i];
            if(i< indexMultiplier)
                bases[i] = f.bases[i];
            // if(i < numMeta) bases[i] = f.bases[i];
            // if(i < numMeta) signs[i] = f.signs[i];
        } 

        emit DynamicPodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, values, bases, f.signs);
        // emit DynamicPodOrderCreated(msg.sender, id, beanAmount, pricePerPod, maxPlaceInLine, values, bases, signs);
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
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.f.mode, o.f.values, o.f.bases, o.f.signs);
        uint256 placeInLine = index + start - s.f.harvestable;

        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        require((placeInLine + amount) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        uint256 costInBeans;
        if(o.f.mode == PricingMode.CONSTANT){
            costInBeans = amount.mul(o.pricePerPod).div(1000000);
        } else {
            costInBeans = getOrderAmount(o.f, placeInLine, amount);
        }
        
        s.podOrders[id] = s.podOrders[id].sub(costInBeans);
        LibTransfer.sendToken(C.bean(), costInBeans, msg.sender, mode);
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        _transferPlot(msg.sender, o.account, index, start, amount);

        if (s.podOrders[id] == 0) delete s.podOrders[id];
        
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount);
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
        // (uint256[numValues] memory values, uint8[numMeta] memory bases, bool[numMeta] memory signs) = createZeros();
        (uint256[numValues] memory values, uint256[indexMultiplier] memory bases, uint256 signs) = createZeros();
        bytes32 id = createOrderIdMem(msg.sender, pricePerPod, maxPlaceInLine, PricingMode.CONSTANT, values, bases, signs);
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
        // PiecewiseFunction calldata f
        PackedPiecewiseFunction calldata f
    ) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, f.mode, f.values, f.bases, f.signs);
        uint256 amountBeans = s.podOrders[id];
        LibTransfer.sendToken(C.bean(), amountBeans, msg.sender, mode);
        delete s.podOrders[id];
        
        emit PodOrderCancelled(msg.sender, id);
    }

    /*
    * PRICING
    */
    function getOrderAmount(
        // PiecewiseFunction calldata f, 
        PackedPiecewiseFunction calldata f,
        uint256 placeInLine, 
        uint256 amount
    ) internal pure returns (uint256 beanAmount) { 
        uint256[] memory subintervals = parseIntervals(f.values);

        require(placeInLine < subintervals[subintervals.length-1]);

        uint256 i;

        if(placeInLine > subintervals[0]) {
            i = findIndex(subintervals, placeInLine);
            i = i > 0 ? i - 1 : 0;
        }
        uint256 end = placeInLine + amount;

        while(placeInLine < end) { 

            //error if end is not within interval range
            uint256 degree = getPackedFunctionDegree(f, i);
            // uint256 degree = getFunctionDegree(f, i);
            // console.log(i, subintervals.length, degree);
            
            if(i < subintervals.length - 1 && end > subintervals[i+1]) {
                //current end index reaches into next piecewise domain
                // uint256 term = evalPiecewiseFunctionIntegrate(f, placeInLine, subintervals[i+1], i, degree);
                uint256 term = evalPackedPFIntegrate(f, placeInLine, subintervals[i+1], i, degree);
                // console.log(term);
                beanAmount = beanAmount.add(term);

                placeInLine = subintervals[i+1]; // set place in line to the end index
                if(i< subintervals.length - 1) i++;
            
            } else {
                // console.log(2, placeInLine);
                uint256 term = evalPackedPFIntegrate(f, placeInLine, end, i, degree);
                // uint256 term = evalPiecewiseFunctionIntegrate(f, placeInLine, end, i, degree);
                beanAmount = beanAmount.add(term);
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
        uint256[numValues] memory values,
        uint256[indexMultiplier] memory bases,
        uint256 signs
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, priceMode == PricingMode.CONSTANT, values, bases, signs));
    }

    function createOrderId(
        address account,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        PricingMode priceMode,
        uint256[numValues] calldata values,
        uint256[indexMultiplier] calldata bases,
        uint256 signs
    ) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, priceMode == PricingMode.CONSTANT, values, bases, signs));
    }
    //  function createOrderIdMem(
    //     address account,
    //     uint24 pricePerPod,
    //     uint256 maxPlaceInLine,
    //     PricingMode priceMode,
    //     uint256[numValues] memory values,
    //     uint8[numMeta] memory bases,
    //     bool[numMeta] memory signs
    // ) internal pure returns (bytes32 id) {
    //     id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, priceMode == PricingMode.CONSTANT, values, bases, signs));
    // }

    // function createOrderId(
    //     address account,
    //     uint24 pricePerPod,
    //     uint256 maxPlaceInLine,
    //     PricingMode priceMode,
    //     uint256[numValues] calldata values,
    //     uint8[numMeta] calldata bases,
    //     bool[numMeta] calldata signs
    // ) internal pure returns (bytes32 id) {
    //     id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, priceMode == PricingMode.CONSTANT, values, bases, signs));
    // }
}
