/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Listing.sol";

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

    function _createPodOrder(
        uint256 beanAmount, 
        uint24 pricePerPod, 
        uint256 maxPlaceInLine
    ) internal returns (bytes32 id) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine);
    }

    function __createPodOrder(
        uint256 amount, 
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) internal  returns (bytes32 id) {
        require(amount > 0, "Marketplace: Order amount must be > 0.");
        id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);
        if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, false);
        s.podOrders[id] = amount;
        emit PodOrderCreated(msg.sender, id, amount, pricePerPod, maxPlaceInLine);
    }
    
    /*
     * Fill
     */
    
    function _fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        bool toWallet
    ) internal {
        bytes32 id = createOrderId(o.account, o.pricePerPod, o.maxPlaceInLine);
        s.podOrders[id] = s.podOrders[id].sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invalid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");
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

     function _cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, bool toWallet) internal {
        bytes32 id = createOrderId(msg.sender, pricePerPod, maxPlaceInLine);
        uint256 amountBeans = (pricePerPod * s.podOrders[id]) / 1000000;
        if (toWallet) bean().transfer(msg.sender, amountBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(amountBeans);
        delete s.podOrders[id];
        emit PodOrderCancelled(msg.sender, id);
     }

    /*
     * Helpers
     */

    function createOrderId(address account, uint24 pricePerPod, uint256 maxPlaceInLine) internal pure returns (bytes32 id) {
        id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));
    }
}