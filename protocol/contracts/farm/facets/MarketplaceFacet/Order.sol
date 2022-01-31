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

    event PodOrderCreated(
        address indexed account, 
        bytes20 id, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint232 maxPlaceInLine
    );
    event PodOrderFilled(
        address indexed from, 
        address indexed to, 
        bytes20 id, 
        uint256 index, 
        uint256 start, 
        uint256 amount
    );
    event PodOrderCancelled(address indexed account, bytes20 id);

    /*
     * Create
     */

    function _buyBeansAndCreatePodOrder(
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine
    ) internal returns (bytes20 id) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount+boughtBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function _createPodOrder(
        uint256 beanAmount, 
        uint24 pricePerPod, 
        uint232 maxPlaceInLine
    ) internal returns (bytes20 id) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine);
    }

    function __createPodOrder(
        uint256 amount, 
        uint24 pricePerPod, 
        uint232 maxPlaceInLine
    ) internal  returns (bytes20 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        bytes20 id = createPodOrderId(maxPlaceInLine);
        s.podOrders[id].amount = amount;
        s.podOrders[id].pricePerPod = pricePerPod;
        s.podOrders[id].maxPlaceInLine = maxPlaceInLine;
        s.podOrders[id].owner = msg.sender;
        emit PodOrderCreated(msg.sender, id, amount, pricePerPod, maxPlaceInLine);
        return id;
    }
    
    /*
     * Fill
     */
    
    function _fillPodOrder(
        bytes20 id,
        uint256 index,
        uint256 start,
        uint232 amount,
        bool toWallet
    ) internal {
        Storage.Order storage order = s.podOrders[id];
        uint24 price = order.pricePerPod;
        address owner = order.owner;
        order.amount = order.amount.sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= order.maxPlaceInLine, "Marketplace: Plot too far in line.");
        uint256 costInBeans = (price * amount) / 1000000;
        if (toWallet) bean().transfer(msg.sender, costInBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(costInBeans);
        if (s.podListings[index].pricePerPod > 0){
            _cancelPodListing(index);
        }
        _transferPlot(msg.sender, owner, index, start, amount);
        if (order.amount == 0){
            delete s.podOrders[id];
        }
        emit PodOrderFilled(msg.sender, owner, id, index, start, amount);
    }

    /*
     * Cancel
     */

     function _cancelPodOrder(bytes20 podOrderIndex, bool toWallet) internal {
        Storage.Order storage order = s.podOrders[podOrderIndex];
        require(order.owner == msg.sender, "Marketplace: Buy Order not owned by user.");
        uint256 amount = order.amount;
        uint256 price = order.pricePerPod;
        uint256 costInBeans = (price * amount) / 1000000;
        if (toWallet) bean().transfer(msg.sender, costInBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(costInBeans);
        delete s.podOrders[podOrderIndex];
        emit PodOrderCancelled(msg.sender, podOrderIndex);
     }

    /*
     * Helpers
     */

    function createPodOrderId(uint256 maxPlaceInLine) private returns (bytes20 id) {
        // Generate the Buy Order Id from sender + block hash
        id = bytes20(keccak256(abi.encodePacked(msg.sender, maxPlaceInLine, blockhash(block.number - 1))));
        // Make sure this podOrderId has not been used before (could be in the same block).
        while (s.podOrders[id].pricePerPod != 0) {
            id = bytes20(keccak256(abi.encodePacked(id)));
        }
        return id;
    }
}