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

    function createPodListing(
        uint256 index, 
        uint128 start, 
        uint128 amount, 
        uint24 pricePerPod, 
        uint224 maxHarvestableIndex, 
        bool toWallet
    ) external {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        if (s.podListings[index].pricePerPod > 0){
            cancelPodListing(index);
        }

        s.podListings[index].start = start;
        if (plotSize > amount) s.podListings[index].amount = amount;
        s.podListings[index].pricePerPod = pricePerPod;
        s.podListings[index].maxHarvestableIndex = maxHarvestableIndex;
        s.podListings[index].toWallet = toWallet;

        emit PodListingCreated(msg.sender, index,  start, amount, pricePerPod, maxHarvestableIndex, toWallet);
    }

    function podListing(address owner, uint256 index) external view returns (Storage.Listing memory) {
        Storage.Listing memory listing = s.podListings[index];
        if (listing.pricePerPod > 0 && listing.amount == 0) {
            listing.amount = uint128(s.a[owner].field.plots[index].sub(listing.start));
        }
       return listing;
    }

    function cancelPodListing(uint256 index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Listing not owned by user.");
        delete s.podListings[index];
        emit PodListingCancelled(msg.sender, index);
    }

    function fillPodListing(address from, uint256 index, uint256 start, uint256 beanAmount, uint24 pricePerPod) external {
        LibMarket.transferBeans(from, beanAmount, s.podListings[index].toWallet);
        _fillListing(from, index, start, beanAmount, pricePerPod);
    }

    function claimAndFillPodListing(address from, uint256 index, uint256 start, uint256 beanAmount, uint24 pricePerPod, LibClaim.Claim calldata claim) external  {
        allocateBeansToWallet(claim, beanAmount, from, s.podListings[index].toWallet);
        _fillListing(from, index, start, beanAmount, pricePerPod);
    }


    function buyBeansAndFillPodListing(address from, uint256 index, uint256 start, uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod) external payable {
        if (beanAmount > 0) LibMarket.transferBeans(from, beanAmount, s.podListings[index].toWallet);
        _buyBeansAndFillPodListing(from, index, start, beanAmount, buyBeanAmount, pricePerPod);
    }

    function claimBuyBeansAndFillPodListing(address from, uint256 index, uint256 start, uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod, LibClaim.Claim calldata claim) external payable  {
        allocateBeansToWallet(claim, beanAmount, from, s.podListings[index].toWallet);
        _buyBeansAndFillPodListing(from, index, start, beanAmount, buyBeanAmount, pricePerPod);
    }

    function _buyBeansAndFillPodListing(address from, uint256 index, uint256 start, uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokensToWallet(buyBeanAmount, from, s.podListings[index].toWallet);
        _fillListing(from, index, start, beanAmount+buyBeanAmount, pricePerPod);
    }

    /*
     * Pod Orders
    **/

    function createPodOrder(uint256 beanAmount, uint24 pricePerPod, uint232 maxPlaceInLine) public returns (bytes20 podOrderId) {
        bean().transferFrom(msg.sender, address(this), beanAmount);
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimAndCreatePodOrder(uint256 beanAmount, uint24 pricePerPod, uint232 maxPlaceInLine, LibClaim.Claim calldata claim) external  returns (bytes20 podOrderId) {
        allocateBeans(claim, beanAmount, address(this));
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
    }

    function buyBeansAndCreatePodOrder(uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod, uint232 maxPlaceInLine) external payable returns (bytes20 podOrderId) {
        if (beanAmount > 0) bean().transferFrom(msg.sender, address(this), beanAmount);
        return _buyBeansAndCreatePodOrder(beanAmount, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimBuyBeansAndCreatePodOrder(uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod, uint232 maxPlaceInLine, LibClaim.Claim calldata claim) external payable returns (bytes20 podOrderId) {
        allocateBeans(claim, beanAmount, address(this));
        return _buyBeansAndCreatePodOrder(beanAmount, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function _buyBeansAndCreatePodOrder(uint256 beanAmount, uint256 buyBeanAmount, uint24 pricePerPod, uint232 maxPlaceInLine) internal returns (bytes20 podOrderId) {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        return _createPodOrder(beanAmount+boughtBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function _createPodOrder(uint256 beanAmount, uint24 pricePerPod, uint232 maxPlaceInLine) internal returns (bytes20 podOrderId) {
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        return  __createPodOrder(amount,pricePerPod, maxPlaceInLine);
    }

    function podOrder(bytes20 podOrderIndex) public view returns (Storage.Order memory) {
       return s.podOrders[podOrderIndex];
    }

    function fillPodOrder(bytes20 orderId, uint256 index, uint256 start, uint232 amount, bool toWallet) external  {
        Storage.Order storage order = s.podOrders[orderId];
        uint24 price = order.pricePerPod;
        address owner = order.owner;
        order.amount = order.amount.sub(amount);
        require(s.a[msg.sender].field.plots[index] >= (start + amount), "Marketplace: Invaid Plot.");
        uint256 placeInLineEndPlot = index + start + amount - s.f.harvestable;
        require(placeInLineEndPlot <= order.maxPlaceInLine, "Marketplace: Plot too far in line.");
        uint256 costInBeans = (price * amount) / 1000000;
        if (toWallet) bean().transfer(msg.sender, costInBeans);
        else s.a[msg.sender].wrappedBeans = s.a[msg.sender].wrappedBeans.add(costInBeans);
        if (s.podListings[index].pricePerPod > 0){
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
        uint256 price = order.pricePerPod;
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

    /*
     * Transfer Plot
     */

     function transferPlot(address sender, address recipient, uint256 id, uint256 start, uint256 end)
        external
    {
        require(sender != address(0), "Field: Transfer from 0 address.");
        require(recipient != address(0), "Field: Transfer to 0 address.");
        require(end > start, "Field: Pod range invalid.");
        uint256 amount = s.a[msg.sender].field.plots[id];
        require(amount > 0, "Field: Plot not owned by user.");
        require(amount >= end, "Field: Pod range too long.");
        amount = end.sub(start);
        insertPlot(recipient,id.add(start),amount);
        removePlot(sender,id,start,end);
        if (msg.sender != sender && allowancePods(sender, msg.sender) != uint256(-1)) {
                decrementAllowancePods(sender, msg.sender, amount);
        }

        if (s.podListings[id].pricePerPod > 0){
            cancelPodListing(id);
        }

        emit PlotTransfer(sender, recipient, id.add(start), amount);
    }

    function approvePods(address spender, uint256 amount) external {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(msg.sender, spender, amount);
        emit PodApproval(msg.sender, spender, amount);
    }
}
