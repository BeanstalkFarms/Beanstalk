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

    function listPlot(uint256 index, uint256 amount, uint256 distanceFromBack, uint24 pricePerPod, uint232 expiry) public {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (distanceFromBack + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= expiry, "Marketplace: Invalid Expiry.");
        if (s.podListings[index].price > 0){
            cancelListing(index);
        }

        // Optimization: if Listing is full amount of plot, set amount to 0
        // Later, we consider a valid Listing (price>0) with amount 0 to be full amount of plot
        if (amount == plotSize) {
            s.podListings[index].amount = 0;
        }
        else{
            s.podListings[index].amount = amount;
            s.podListings[index].distanceFromBack = distanceFromBack;
        }
        s.podListings[index].expiry = expiry;
        s.podListings[index].price = pricePerPod;
        emit PodListingCreated(msg.sender, index, amount, distanceFromBack, pricePerPod, expiry);
    }

    function podListing (uint256 index, address owner) public view returns (Storage.Listing memory) {
        Storage.Listing memory listing = s.podListings[index];
        if (listing.price > 0 && listing.amount == 0){
            listing.amount = s.a[owner].field.plots[index];
        }
       return listing;
    }

    function cancelListing(uint256 index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Listing not owned by user.");
        delete s.podListings[index];
        emit PodListingCancelled(msg.sender, index);
    }

    function buyListing(address from, uint256 index, uint256 distanceFromBack, uint256 amountBeans) public {
        bean().transferFrom(msg.sender, from, amountBeans);
        _buyListing(from, index, distanceFromBack, amountBeans);
    }

    function claimAndBuyListing(address from, uint256 index, uint256 distanceFromBack, uint256 amountBeans, LibClaim.Claim calldata claim) public  {
        allocateBeans(claim, amountBeans, from);
        _buyListing(from, index, distanceFromBack, amountBeans);
    }


    function buyBeansAndBuyListing(address from, uint256 index, uint256 distanceFromBack, uint256 amountBeans, uint256 buyBeanAmount) public payable {
        if (amountBeans > 0) bean().transferFrom(msg.sender, from, amountBeans);
        _buyBeansAndListing(from, index, distanceFromBack, amountBeans, buyBeanAmount);
    }

    function claimAndBuyBeansAndBuyListing(address from, uint256 index, uint256 distanceFromBack, uint256 amountBeans, uint256 buyBeanAmount, LibClaim.Claim calldata claim) public payable  {
        allocateBeans(claim, amountBeans, from);
        _buyBeansAndListing(from, index, distanceFromBack, amountBeans, buyBeanAmount);
    }

    function _buyBeansAndListing(address from, uint256 index, uint256 distanceFromBack, uint256 amountBeans, uint256 buyBeanAmount) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, from);
        _buyListing(from, index, distanceFromBack, amountBeans+buyBeanAmount);
    }

    function _buyListing(address from, uint256 index, uint256 distanceFromBack, uint256 amountBeans) internal {
        uint24 price = s.podListings[index].price;
        require(price > 0, "Marketplace: Listing does not exist.");
        uint256 amount = (amountBeans * 1000000) / price;
        uint256 listingAmount = s.podListings[index].amount;
        if (listingAmount == 0){
            listingAmount = s.a[from].field.plots[index];
        }
        // If remainder left (always <1 pod) that would otherwise be unpurchaseable
        // due to rounding from calculating amount, give it to last buyer
        if ((listingAmount - amount) < (1000000 / price))
            amount = listingAmount;
        __buyListing(from, index, distanceFromBack, amount);
    }

    /*
     * Pod Orders
    **/

    function listOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) public returns (bytes20 podOrderId) {
        bean().transferFrom(msg.sender, address(this), amountBeans);
        return _listOrder(maxPlaceInLine, pricePerPod, amountBeans);
    }

    function claimAndListOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, LibClaim.Claim calldata claim) public  returns (bytes20 podOrderId) {
        allocateBeans(claim, amountBeans, address(this));
        return _listOrder(maxPlaceInLine, pricePerPod, amountBeans);
    }

    function buyBeansAndListOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) public payable returns (bytes20 podOrderId) {
        if (amountBeans > 0) bean().transferFrom(msg.sender, address(this), amountBeans);
        return _buyBeansAndListOrder(maxPlaceInLine, pricePerPod, amountBeans, buyBeanAmount);
    }

    function claimAndBuyBeansAndListOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount, LibClaim.Claim calldata claim) public payable returns (bytes20 podOrderId) {
        allocateBeans(claim, amountBeans, address(this));
        return _buyBeansAndListOrder(maxPlaceInLine, pricePerPod, amountBeans, buyBeanAmount);
    }

    function _buyBeansAndListOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) internal returns (bytes20 podOrderId) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _listOrder(maxPlaceInLine,pricePerPod,amountBeans+boughtBeanAmount);
    }

    function _listOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) internal returns (bytes20 podOrderId) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (amountBeans * 1000000) / pricePerPod;
        return  __listOrder(maxPlaceInLine,pricePerPod,amount);
    }

    function podOrder(bytes20 podOrderIndex) public view returns (Storage.Order memory) {
       return s.podOrders[podOrderIndex];
    }

    function sellToOrder(uint256 plotIndex, uint256 sellFromIndex, bytes20 podOrderIndex, uint232 amount) public  {
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
            cancelListing(plotIndex);
        }
        _transferPlot(msg.sender, owner, plotIndex, sellFromIndex.sub(plotIndex), amount);
        if (order.amount == 0){
            delete s.podOrders[podOrderIndex];
        }
        emit PodOrderFilled(msg.sender, owner, podOrderIndex, sellFromIndex, amount, price);
    }

    function cancelOrder(bytes20 podOrderIndex) public  {
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
