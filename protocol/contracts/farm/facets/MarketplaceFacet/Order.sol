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
        uint24 pricePerPod; //starting price per pod -> at maxplaceinline index pod will be valued at this
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
        uint256 maxPlaceInLine
    ) internal returns (bytes32 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount+boughtBeanAmount, pricePerPod, maxPlaceInLine);
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
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine);
    }

    function __createPodOrder(
        uint256 amount, 
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint8 functionType,
        Formula calldata f
    ) internal  returns (bytes32 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, functionType, f);
        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, false);
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
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine, o.functionType, o.f);
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

        //cost in beans
        uint256 costInBeans = (o.pricePerPod * amount) / 1000000;
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
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine, functionType, f);
        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(amountBeans);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
     }

    /*
     * Helpers
     */

    function createOrderId(address account, uint24 pricePerPod, uint256 maxPlaceInLine, uint8 functionType, Formula f) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, functionType, f));
    }

    function getOrderCostConst(Order calldata o, uint256 amount, uint256 index) pure internal returns (uint256) {

        return amount * 1000000 / l.pricePerPod; // units: 1000000 = 1
    }

    function getOrderAmountLin(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; // units: 1 
        uint256 a = f.a.mul(10**(37-f.aShift)); // 1eU
        uint256 pricePerPod = a.mul(x) + (l.pricePerPod * unit) / 1000000;
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount); //units will be 1e36
    }

    function getOrderAmountLog(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; // units: 1 
        uint256 a = f.a.mul(10**(37-f.aShift));// 1eU
        uint256 pricePerPod = log_two((placeInLine + 1).mul(unit)).divdrup(log_two(a)) +( l.pricePerPod * unit) / 1000000;
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount);
    }

    function getOrderAmountSig(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; // units: 1 
        uint256 a = f.a.mul(10**(37-f.aShift));
        uint256 pricePerPod = ((l.pricePerPod * 2 / 1000000) * unit) / (1 + (eN / eD)**(a.mul(placeInLine) * -1));
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount);
    }

    function getListingAmountPoly(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; //units: 1
        uint256 a = f.a.mul(10**(37-f.aShift));
        uint256 pricePerPod = a.mul(x) + (l.pricePerPod * unit) / 1000000;
        if (f.b > 0) {
            uint128 b = f.b.mul(10**(37-f.bShift));
            pricePerPod += b.mul(x**2);
        }
        if (f.c > 0) {
            uint128 c = f.c.mul(10**(37-cShift));
            pricePerPod += c.mul(x**3);
        }
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount);
    }
}