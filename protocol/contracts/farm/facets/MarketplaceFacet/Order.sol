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
        uint240[10] constantsDegreeZero,
        uint8[10] shiftsDegreeZero,
        bool[10] boolsDegreeZero,
        uint240[10] constantsDegreeOne,
        uint8[10] shiftsDegreeOne,
        bool[10] boolsDegreeOne,
        uint240[10] constantsDegreeTwo,
        uint8[10] shiftsDegreeTwo,
        bool[10] boolsDegreeTwo,
        uint240[10] constantsDegreeThree,
        uint8[10] shiftsDegreeThree,
        bool[10] boolsDegreeThree
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
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount+boughtBeanAmount, pricePerPod, maxPlaceInLine, constantPricing, f);
    }

    function _createPodOrder(
        uint256 beanAmount, 
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal returns (bytes32 id) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine, constantPricing, f);
    }

    function __createPodOrder(
        uint256 amount, 
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal  returns (bytes32 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, constantPricing, f.subIntervalIndex,
        f.constantsDegreeZero,f.shiftsDegreeZero, f.boolsDegreeZero, 
        f.constantsDegreeOne, f.shiftsDegreeOne, f.boolsDegreeOne, 
        f.constantsDegreeTwo, f.shiftsDegreeTwo, f.boolsDegreeTwo, 
        f.constantsDegreeThree, f.shiftsDegreeThree, f.boolsDegreeThree);
        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, false, constantPricing, f);
        s.podOrders[id] = amount;
        emit PodOrderCreated(msg.sender, id, amount, pricePerPod, maxPlaceInLine, constantPricing, f.constantsDegreeZero,f.shiftsDegreeZero, f.boolsDegreeZero, 
            f.constantsDegreeOne, f.shiftsDegreeOne, f.boolsDegreeOne, 
            f.constantsDegreeTwo, f.shiftsDegreeTwo, f.boolsDegreeTwo, 
            f.constantsDegreeThree, f.shiftsDegreeThree, f.boolsDegreeThree);
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
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.constantPricing, o.f.constantsDegreeZero,o.f.shiftsDegreeZero, o.f.boolsDegreeZero, 
            o.f.constantsDegreeOne, o.f.shiftsDegreeOne, o.f.boolsDegreeOne, 
            o.f.constantsDegreeTwo, o.f.shiftsDegreeTwo, o.f.boolsDegreeTwo, 
            o.f.constantsDegreeThree, o.f.shiftsDegreeThree, o.f.boolsDegreeThree);
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        // place in line for middle plot
        uint256 placeInLineMidPlot = index + start + (amount / 2) - s.f.harvestable;

        //cost in beans
        // uint256 costInBeans = (o.pricePerPod * amount) / 1000000;
        uint256 costInBeans;
        uint256 pricePerPod;
        if (o.constantPricing) {
            pricePerPod = o.pricePerPod;
        }
        else {
            pricePerPod = MathFP.evaluatePCubicP(o.f, placeInLineMidPlot);
        }

        costInBeans = pricePerPod * amount / 1000000;

        if (toWallet) bean().transfer(msg.sender, costInBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(costInBeans);
        if (s.podListings[index] != bytes32(0)){
            _cancelPodListing(index);
        }
        _transferPlot(msg.sender, o.account, index, start, amount);
        if (s.podOrders[id] == 0){
            delete s.podOrders[id];
        }
        emit PodOrderFilled(msg.sender, o.account, id, index, start, amount);
    }

    /*
     * Cancel
     */

     function _cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, bool toWallet, bool constantPricing, MathFP.PiecewiseFormula calldata f) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, constantPricing, f.constantsDegreeZero,f.shiftsDegreeZero, f.boolsDegreeZero, 
            f.constantsDegreeOne, f.shiftsDegreeOne, f.boolsDegreeOne, 
            f.constantsDegreeTwo, f.shiftsDegreeTwo, f.boolsDegreeTwo, 
            f.constantsDegreeThree, f.shiftsDegreeThree, f.boolsDegreeThree);
            //revisit
        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(amountBeans);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
     }

    /*
     * Helpers
     */

    function createOrderId(address account, uint24 pricePerPod, uint256 maxPlaceInLine, uint8 fType, uint240[4] memory f, uint8[4] memory fShifts, bool[4] memory fSigns) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, fType, f, fShifts, fSigns));
    }

}