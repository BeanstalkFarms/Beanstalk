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
        uint8 functionType; //1, 0 = constant, 1 = linear, 2 = log, 3 = sigmoid, 4 = poly 2, 5 = poly 3, 6 = poly 4
        Formula f;
        uint256 maxPlaceInLine; //highest index that the order will buy
    }

    event PodOrderCreated(
        address indexed account, 
        bytes32 id, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
        uint8 functionType,
        uint120[3] f,
        uint8[3] fShift
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
        uint8 functionType,
        Formula calldata f
    ) internal returns (bytes32 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount+boughtBeanAmount, pricePerPod, maxPlaceInLine, functionType, f);
    }

    function _createPodOrder(
        uint256 beanAmount, 
        uint24 pricePerPod, 
        uint256 maxPlaceInLine,
        uint8 functionType,
        Formula calldata f
    ) internal returns (bytes32 id) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine, functionType, f);
    }

    function __createPodOrder(
        uint256 amount, 
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint8 functionType,
        Formula calldata f
    ) internal  returns (bytes32 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, functionType, [f.a,f.b,f.c],[f.aShift,f.bShift,f.cShift]);
        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, false, functionType, f);
        s.podOrders[id] = amount;
        emit PodOrderCreated(msg.sender, id, amount, pricePerPod, maxPlaceInLine, functionType, [f.a,f.b,f.c],[f.aShift,f.bShift,f.cShift]);
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
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.functionType, [o.f.a, o.f.b, o.f.c], [o.f.aShift, o.f.bShift, o.f.cShift]);
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        //cost in beans
        // uint256 costInBeans = (o.pricePerPod * amount) / 1000000;
        uint256 costInBeans;
        if (o.functionType == 0) {
            costInBeans = getOrderAmountConst(o.pricePerPod, amount);
        }
        else if (o.functionType == 1) {
            costInBeans = getOrderAmountLin(o, o.f, amount, placeInLineEndPlot);
        } 
        else if (o.functionType == 2) {
            costInBeans = getOrderAmountLog(o, o.f, amount, placeInLineEndPlot);
        }
        else if (o.functionType == 3) {
            costInBeans = getOrderAmountSig(o, o.f, amount, placeInLineEndPlot);
        }
        else if (o.functionType == 4) {
            costInBeans = getOrderAmountPoly(o, o.f, amount, placeInLineEndPlot);
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

     function _cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, bool toWallet, uint8 functionType, Formula calldata f) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, functionType, [f.a, f.b, f.c], [f.aShift, f.bShift, f.cShift]);
        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(amountBeans);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
     }

    /*
     * Helpers
     */

    function createOrderId(address account, uint24 pricePerPod, uint256 maxPlaceInLine, uint8 functionType, uint120[3] memory f, uint8[3] memory fS) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, functionType, f, fS));
    }

    function getOrderAmountConst(uint24 price, uint256 amount) pure internal returns (uint256 amount) {
        amount = (price * amount) / 1000000; // units: 1000000 = 1
    }

    // calculating the x for this function -> aims to be the place in line for the end index
    function getOrderAmountLin(Order calldata o, Formula calldata f, uint256 amount, uint256 placeInLineEndPlot) internal returns (uint256 amount) {
        uint256 x = placeInLineEndPlot * unit; //fixed point
        uint256 a = f.a * unit / (10**f.aShift); // converts to fixed point (36 dec) but accounts for f.aShift
        uint256 pricePerPod = MathFP.muld(x,a) + (o.pricePerPod) / 1000000; 
        amount = amount * 1000000 * pricePerPod; 
    }

    function getOrderAmountLog(Order calldata o, Formula calldata f, uint256 amount, uint256 placeInLineEndPlot) internal returns (uint256 amount) {
        uint256 x = placeInLineEndPlot * unit;
        uint256 a = f.a * unit / (10**f.aShift); // converts to fixed point (36 dec) but accounts for f.aShift
        uint256 log1 = LibIncentive.log_two(x+1);
        uint256 log2 = LibIncentive.log_two(a);
        uint256 pricePerPod = MathFP.divdr(log1, log2) + o.pricePerPod / 1000000;
        amount = amount * 1000000 * pricePerPod; 
    }

    function getOrderAmountSig(Order calldata o, Formula calldata f, uint256 amount, uint256 placeInLineEndPlot) internal returns (uint256 amount) {
        uint256 x = placeInLineEndPlot * unit;
        uint256 a = f.a * unit / (10**f.aShift); // converts to fixed point (36 dec) but accounts for f.aShift
        uint256 n = o.pricePerPod * 2 / 1000000 * unit; //numerator
        uint256 d = (1 + (eN / eD)**(MathFP.muld(x,a) * -1)) * unit; //denominator -> convert e to be a fixed number 
        uint256 pricePerPod = MathFP.divdr(n,d);
        amount = amount * 1000000 * pricePerPod; 
    }

    function getOrderAmountPoly(Order calldata o, Formula calldata f, uint256 amount, uint256 placeInLineEndPlot) internal returns (uint256 amount) {
        uint256 x = placeInLineEndPlot * unit;
        uint256 a = f.a * unit / (10**f.aShift);
        uint256 pricePerPod = MathFP.muld(x,a) + o.pricePerPod / 1000000;
        if (f.b > 0) {
            uint256 b = f.b * unit / (10**f.bShift);
            pricePerPod += MathFP.muld(b, x**2);
        }
        if (f.c > 0) {
            uint256 c = f.c * unit / (10**f.cShift);
            pricePerPod += MathFP.muld(c, x**3);
        }
        amount = amount * 1000000 * pricePerPod; 
    }
}