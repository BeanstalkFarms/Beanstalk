/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Marketplace.sol";
import "hardhat/console.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/

contract MarketplaceFacet is Marketplace {

    using SafeMath for uint256;

    /*
     * Listing
     */

    // function createPodListing(uint256 index, Storage.Listing calldata l) external {
        // uint256 plotSize = s.a[msg.sender].field.plots[index];
    function createPodListing(
        uint256 index, 
        uint128 start, 
        uint128 amount, 
        uint24 price, 
        uint224 maxHarvestableIndex, 
        bool toWallet
    ) external {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(0 < price, "Marketplace: Pod price must be greater than 0.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        if (s.podListings[index].price > 0){
            cancelPodListing(index);
        }

        s.podListings[index].start = start;
        if (plotSize > amount) s.podListings[index].amount = amount;
        s.podListings[index].price = price;
        s.podListings[index].maxHarvestableIndex = maxHarvestableIndex;
        s.podListings[index].toWallet = toWallet;

        emit PodListingCreated(msg.sender, index,  start, amount, price, maxHarvestableIndex, toWallet);
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
        LibMarket.transferBeans(from, amountBeans, s.podListings[index].toWallet);
        _buyListing(from, index, start, amountBeans, pricePerPod);
    }

    function claimAndBuyPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint24 pricePerPod, LibClaim.Claim calldata claim) public  {
        allocateBeansToWallet(claim, amountBeans, from, s.podListings[index].toWallet);
        _buyListing(from, index, start, amountBeans, pricePerPod);
    }


    function buyBeansAndBuyPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod) public payable {
        if (amountBeans > 0) LibMarket.transferBeans(from, amountBeans, s.podListings[index].toWallet);
        _buyBeansAndPodListing(from, index, start, amountBeans, buyBeanAmount, pricePerPod);
    }

    function claimBuyBeansAndBuyPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod, LibClaim.Claim calldata claim) public payable  {
        allocateBeansToWallet(claim, amountBeans, from, s.podListings[index].toWallet);
        _buyBeansAndPodListing(from, index, start, amountBeans, buyBeanAmount, pricePerPod);
    }

    function _buyBeansAndPodListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokensToWallet(buyBeanAmount, from, s.podListings[index].toWallet);
        _buyListing(from, index, start, amountBeans+buyBeanAmount, pricePerPod);
    }

    /*
     * Pod Orders
    **/

    function createPodOrder(uint256 amountBeans, uint24 pricePerPod, uint232 maxPlaceInLine) public returns (bytes20 podOrderId) {
        bean().transferFrom(msg.sender, address(this), amountBeans);
        return _createOrder(amountBeans, pricePerPod, maxPlaceInLine);
    }

    function claimAndCreatePodOrder(uint256 amountBeans, uint24 pricePerPod, uint232 maxPlaceInLine, LibClaim.Claim calldata claim) public  returns (bytes20 podOrderId) {
        allocateBeans(claim, amountBeans, address(this));
        return _createOrder(amountBeans, pricePerPod, maxPlaceInLine);
    }

    function buyBeansAndCreatePodOrder(uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod, uint232 maxPlaceInLine) public payable returns (bytes20 podOrderId) {
        if (amountBeans > 0) bean().transferFrom(msg.sender, address(this), amountBeans);
        return _buyBeansAndCreatePodOrder(amountBeans, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimBuyBeansAndCreatePodOrder(uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod, uint232 maxPlaceInLine, LibClaim.Claim calldata claim) public payable returns (bytes20 podOrderId) {
        allocateBeans(claim, amountBeans, address(this));
        return _buyBeansAndCreatePodOrder(amountBeans, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function _buyBeansAndCreatePodOrder(uint256 amountBeans, uint256 buyBeanAmount, uint24 pricePerPod, uint232 maxPlaceInLine) internal returns (bytes20 podOrderId) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createOrder(amountBeans+boughtBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function _createOrder(uint256 amountBeans, uint24 pricePerPod, uint232 maxPlaceInLine) internal returns (bytes20 podOrderId) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (amountBeans * 1000000) / pricePerPod;
        return  __createOrder(amount,pricePerPod, maxPlaceInLine);
    }

    function podOrder(bytes20 podOrderIndex) public view returns (Storage.Order memory) {
       return s.podOrders[podOrderIndex];
    }

    function sellToPodOrder(bytes20 orderId, uint256 index, uint256 start, uint232 amount, bool toWallet) public  {
        Storage.Order storage order = s.podOrders[orderId];
        uint24 price = order.price;
        address owner = order.owner;
        order.amount = order.amount.sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invaid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= order.maxPlaceInLine, "Marketplace: Plot too far in line.");
        uint256 costInBeans = (price * amount) / 1000000;
        if (toWallet) bean().transfer(msg.sender, costInBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(costInBeans);
        if (s.podListings[index].price > 0){
            cancelPodListing(index);
        }
        _transferPlot(msg.sender, owner, index, start, amount);
        if (order.amount == 0){
            delete s.podOrders[orderId];
        }
        emit PodOrderFilled(msg.sender, owner, orderId, index, start, amount);
    }

    function cancelPodOrder(bytes20 podOrderIndex, bool toWallet) public  {
        Storage.Order storage order = s.podOrders[podOrderIndex];
        require(order.owner == msg.sender, "Marketplace: Buy Order not owned by user.");
        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 costInBeans = (price * amount) / 1000000;
        if (toWallet) bean().transfer(msg.sender, costInBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(costInBeans);
        delete s.podOrders[podOrderIndex];
        emit PodOrderCancelled(msg.sender, podOrderIndex);
    }

    

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, address to) private {
        LibClaim.claim(c);
        LibMarket.allocateBeansTo(transferBeans, to);
    }

    function allocateBeansToWallet(LibClaim.Claim calldata c, uint256 transferBeans, address to, bool toWallet) private {
        LibClaim.claim(c);
        LibMarket.allocateBeansToWallet(transferBeans, to, toWallet);

    }
}
