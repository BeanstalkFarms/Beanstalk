/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Marketplace.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/

contract MarketplaceFacet is Marketplace {

    using SafeMath for uint256;

    /*
     * Listing
     */

    function createPodListing(uint256 index, Storage.Listing calldata l) external {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(0 < l.price, "Marketplace: Pod price must be greater than 0.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= l.expiry, "Marketplace: Invalid Expiry.");
        if (s.podListings[index].price > 0){
            cancelPodListing(index);
        }

        s.podListings[index] = l;
        emit PodListingCreated(msg.sender, index,  l.start, l.amount, l.price, l.expiry, l.toWallet);
    }

    function podListing(address owner, uint256 index) external view returns (Storage.Listing memory) {
        Storage.Listing memory listing = s.podListings[index];
        if (listing.price > 0 && listing.amount == 0) {
            listing.amount = uint128(s.a[owner].field.plots[index].sub(listing.start));
        }
       return listing;
    }

    function cancelPodListing(uint256 index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Listing not owned by user.");
        delete s.podListings[index];
        emit PodListingCancelled(msg.sender, index);
    }

    function buyPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint24 pricePerPod) public {
        bean().transferFrom(msg.sender, from, amountBeans);
        _buyListing(from, index, start, amountBeans, pricePerPod);
    }

    function claimAndBuyPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint24 pricePerPod, LibClaim.Claim calldata claim) public  {
        allocateBeans(claim, amountBeans, from);
        _buyListing(from, index, start, amountBeans, pricePerPod);
    }


    function buyBeansAndBuyPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod) public payable {
        if (amountBeans > 0) bean().transferFrom(msg.sender, from, amountBeans);
        _buyBeansAndPodListing(from, index, start, amountBeans, buyBeanAmount, pricePerPod);
    }

    function claimAndBuyBeansAndBuyListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod, LibClaim.Claim calldata claim) public payable  {
        allocateBeans(claim, amountBeans, from);
        _buyBeansAndPodListing(from, index, start, amountBeans, buyBeanAmount, pricePerPod);
    }

    function _buyBeansAndPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, from);
        _buyListing(from, index, start, amountBeans+buyBeanAmount, pricePerPod);
    }

    /*
     * Pod Orders
    **/

    function listPodOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) public returns (bytes20 podOrderId) {
        bean().transferFrom(msg.sender, address(this), amountBeans);
        return _listOrder(maxPlaceInLine, pricePerPod, amountBeans);
    }

    function claimAndListPodOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, LibClaim.Claim calldata claim) public  returns (bytes20 podOrderId) {
        allocateBeans(claim, amountBeans, address(this));
        return _listOrder(maxPlaceInLine, pricePerPod, amountBeans);
    }

    function buyBeansAndListPodOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) public payable returns (bytes20 podOrderId) {
        if (amountBeans > 0) bean().transferFrom(msg.sender, address(this), amountBeans);
        return _buyBeansAndListPodOrder(maxPlaceInLine, pricePerPod, amountBeans, buyBeanAmount);
    }

    function claimAndBuyBeansAndListPodOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount, LibClaim.Claim calldata claim) public payable returns (bytes20 podOrderId) {
        allocateBeans(claim, amountBeans, address(this));
        return _buyBeansAndListPodOrder(maxPlaceInLine, pricePerPod, amountBeans, buyBeanAmount);
    }

    function _buyBeansAndListPodOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) internal returns (bytes20 podOrderId) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _listOrder(maxPlaceInLine,pricePerPod,amountBeans+boughtBeanAmount);
    }

    function _listOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) internal returns (bytes20 podOrderId) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (amountBeans * 1000000) / pricePerPod;
        return  __listOrder(maxPlaceInLine,pricePerPod,amount);
    }

    function podPodOrder(bytes20 podOrderIndex) public view returns (Storage.Order memory) {
       return s.podOrders[podOrderIndex];
    }

    function sellToPodOrder(uint256 plotIndex, uint256 sellFromIndex, bytes20 podOrderIndex, uint232 amount) public  {
        Storage.Order storage order = s.podOrders[podOrderIndex];
        uint24 price = order.price;
        address owner = order.owner;
        require(price > 0, "Marketplace: Buy Offer does not exist.");
        order.amount = order.amount.sub(amount);
        require(s.a[msg.sender].field.plots[plotIndex] >= (sellFromIndex.sub(plotIndex) + amount), "Marketplace: Invaid Plot.");
        uint256 placeInLineEndPlot = sellFromIndex + amount - s.f.harvestable;
        require(placeInLineEndPlot <= order.maxPlaceInLine, "Marketplace: Plot too far in line.");
        uint256 costInBeans = (price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        if (s.podListings[plotIndex].price > 0){
            cancelPodListing(plotIndex);
        }
        _transferPlot(msg.sender, owner, plotIndex, sellFromIndex.sub(plotIndex), amount);
        if (order.amount == 0){
            delete s.podOrders[podOrderIndex];
        }
        emit PodOrderFilled(msg.sender, owner, podOrderIndex, sellFromIndex, amount, price);
    }

    function cancelPodOrder(bytes20 podOrderIndex) public  {
        Storage.Order storage order = s.podOrders[podOrderIndex];
        require(order.owner == msg.sender, "Field: Buy Offer not owned by user.");
        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 costInBeans = (price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        delete s.podOrders[podOrderIndex];
        emit PodOrderCancelled(msg.sender, podOrderIndex);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, address to) private {
        LibClaim.claim(c);
        LibMarket.allocatedBeansTo(transferBeans, to);
    }
}
