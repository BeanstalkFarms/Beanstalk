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
        uint8 fType; //1, 0 = constant, 1 = linear, 2 = log, 3 = sigmoid, 4 = poly 2, 5 = poly 3, 6 = poly 4
        Formula f;
    }

    event PodOrderCreated(
        address indexed account, 
        bytes32 id, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
        uint8 fType,
        uint240[4] f,
        uint8[4] fShifts,
        bool[4] fSigns
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
        uint8 fType,
        Formula calldata f
    ) internal returns (bytes32 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount+boughtBeanAmount, pricePerPod, maxPlaceInLine, fType, f);
    }

    function _createPodOrder(
        uint256 beanAmount, 
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
        uint8 fType,
        Formula calldata f
    ) internal returns (bytes32 id) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine, fType, f);
    }

    function __createPodOrder(
        uint256 amount, 
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint8 fType,
        Formula calldata f
    ) internal  returns (bytes32 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, fType, [f.a,f.b,f.c, f.d], [f.aShift,f.bShift,f.cShift, f.dShift], [f.aSign, f.bSign, f.cSign, f.dSign]);
        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, false, fType, f);
        s.podOrders[id] = amount;
        emit PodOrderCreated(msg.sender, id, amount, pricePerPod, maxPlaceInLine, fType, [f.a, f.b, f.c, f.d],[f.aShift,f.bShift,f.cShift, f.dShift], [f.aSign, f.bSign, f.cSign, f.dSign]);
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
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.fType, [o.f.a, o.f.b, o.f.c, o.f.d], [o.f.aShift, o.f.bShift, o.f.cShift, o.f.dShift], [o.f.aSign, o.f.bSign, o.f.cSign, o.f.dSign]);
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        // place in line for middle plot
        uint256 placeInLineMidPlot = index + start + (amount / 2) - s.f.harvestable;

        //cost in beans
        // uint256 costInBeans = (o.pricePerPod * amount) / 1000000;
        uint256 costInBeans;
        if (o.fType == 0) {
            costInBeans = getOrderAmountConst(o.pricePerPod, amount);
        }
        else if (o.fType == 1) {
            costInBeans = getOrderAmountLin(o,amount, placeInLineMidPlot);
        } 
        else if (o.fType == 2) {
            costInBeans = getOrderAmountPoly(o, amount, placeInLineMidPlot);
        }

        assert(costInBeans > 0);

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

     function _cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, bool toWallet, uint8 fType, Formula calldata f) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, fType, [f.a, f.b, f.c, f.d], [f.aShift, f.bShift, f.cShift, f.dShift], [f.aSign, f.bSign, f.cSign, f.dSign]);
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

    function getOrderAmountConst(uint24 price, uint256 amount) pure internal returns (uint256) {
        amount = price * amount; 
        return amount;
    }

    function getOrderAmountLin(Order calldata o,uint256 amount, uint256 x) internal returns (uint256) {        
        
        uint256 pricePerPod;
        
        if (o.f.aSign) {
            pricePerPod = MathFP.muld(x, o.f.a, o.f.aShift) + o.pricePerPod;
        } 
        else {
            pricePerPod = o.pricePerPod - MathFP.muld(x, o.f.a, o.f.aShift);
        }
        amount = amount * pricePerPod; 
        return amount;
    }

    // function getOrderAmountLog(Order calldata o, uint256 amount, uint256 x) internal returns (uint256) {

    //     uint256 log1 = LibIncentive.log_two(x+1);
    //     uint256 log2 = LibIncentive.log_two(o.f.a);

    //     uint256 pricePerPod = MathFP.divdr(log1, log2) + o.pricePerPod;

    //     amount = amount * pricePerPod; 
    //     return amount;
    // }

    // function getOrderAmountSig(Order calldata o, uint256 amount, uint256 x) internal returns (uint256) {
       
    //     uint256 n = o.pricePerPod * 2;
    //     uint256 d;

    //     if (o.f.aSign){
    //         d = (1 + (eN / eD)**(1 / MathFP.muld(x, o.f.a, o.f.aShift)));
    //     } else {
    //         d = (1 + (eN / eD)**(MathFP.muld(x, o.f.a, o.f.aShift)));
    //     }
    //     uint256 pricePerPod = n / d;
    //     amount = amount * pricePerPod; 
    //     return amount;
    // }

    function getOrderAmountPoly(Order calldata o, uint256 amount, uint256 x) internal returns (uint256) {
        
        uint256 pricePerPod;

        if (o.f.aSign) {
            pricePerPod = MathFP.muld(x, o.f.a, o.f.aShift) + o.pricePerPod;
        } else {
            pricePerPod = o.pricePerPod - MathFP.muld(x, o.f.a, o.f.aShift);
        }
        
        if (o.f.b > 0) {
            if (o.f.bSign) {
                pricePerPod += MathFP.muld(x**2, o.f.b, o.f.bShift);
            }
            else {
                pricePerPod -= MathFP.muld(x**2, o.f.b, o.f.bShift);
            }
        }
        if (o.f.c > 0) {
            if (o.f.cSign) {
                pricePerPod += MathFP.muld(x**3, o.f.c, o.f.cShift);
            }
            else {
                pricePerPod -= MathFP.muld(x**3, o.f.c, o.f.cShift);
            }
        }
        if (o.f.d > 0) {
            if (o.f.dSign) {
                pricePerPod += MathFP.muld(x**4, o.f.d, o.f.dShift);
            }
            else {
                pricePerPod -= MathFP.muld(x**4, o.f.d, o.f.dShift);
            }
        }
        amount = amount * pricePerPod;
        return amount;
    }
}