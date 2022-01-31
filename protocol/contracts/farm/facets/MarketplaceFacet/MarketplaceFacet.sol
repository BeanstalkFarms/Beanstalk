/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Order.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/

contract MarketplaceFacet is Order {

    using SafeMath for uint256;

    /*
     * Pod Listing
     */

    // Create
    function createPodListing(
        uint256 index,
        uint128 start,
        uint128 amount,
        uint24 pricePerPod,
        uint224 maxHarvestableIndex,
        bool toWallet
    ) external {
        _createPodListing(index, start, amount, pricePerPod, maxHarvestableIndex, toWallet);
    }

    // Fill
    function fillPodListing(
        address from, 
        uint256 index, 
        uint256 start, 
        uint256 beanAmount, 
        uint24 pricePerPod
    ) external {
        LibMarket.transferBeans(from, beanAmount, s.podListings[index].toWallet);
        _fillListing(from, index, start, beanAmount, pricePerPod);
    }

    function claimAndFillPodListing(
        address from,
        uint256 index,
        uint256 start,
        uint256 beanAmount,
        uint24 pricePerPod,
        LibClaim.Claim calldata claim
    ) external  {
        allocateBeansToWallet(claim, beanAmount, from, s.podListings[index].toWallet);
        _fillListing(from, index, start, beanAmount, pricePerPod);
    }


    function buyBeansAndFillPodListing(
        address from,
        uint256 index,
        uint256 start,
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod
    ) external payable {
        if (beanAmount > 0) LibMarket.transferBeans(from, beanAmount, s.podListings[index].toWallet);
        _buyBeansAndFillPodListing(from, index, start, beanAmount, buyBeanAmount, pricePerPod);
    }

    function claimBuyBeansAndFillPodListing(
        address from,
        uint256 index,
        uint256 start,
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        LibClaim.Claim calldata claim
    ) external payable  {
        allocateBeansToWallet(claim, beanAmount, from, s.podListings[index].toWallet);
        _buyBeansAndFillPodListing(from, index, start, beanAmount, buyBeanAmount, pricePerPod);
    }

    // Cancel
    function cancelPodListing(uint256 index) external {
        _cancelPodListing(index);
    }

    // Get
    function podListing(address owner, uint256 index) external view returns (Storage.Listing memory) {
        Storage.Listing memory listing = s.podListings[index];
        if (listing.pricePerPod > 0 && listing.amount == 0) {
            listing.amount = uint128(s.a[owner].field.plots[index].sub(listing.start));
        }
       return listing;
    }

    /*
     * Pod Orders
     */

    // Create
    function createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint232
        maxPlaceInLine
    ) external returns (bytes20 id) {
        bean().transferFrom(msg.sender, address(this), beanAmount);
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimAndCreatePodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine,
        LibClaim.Claim calldata claim
    ) external returns (bytes20 id) {
        allocateBeans(claim, beanAmount, address(this));
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
    }

    function buyBeansAndCreatePodOrder(
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine
    ) external payable returns (bytes20 id) {
        if (beanAmount > 0) bean().transferFrom(msg.sender, address(this), beanAmount);
        return _buyBeansAndCreatePodOrder(beanAmount, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimBuyBeansAndCreatePodOrder(
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine,
        LibClaim.Claim calldata claim
    ) external payable returns (bytes20 id) {
        allocateBeans(claim, beanAmount, address(this));
        return _buyBeansAndCreatePodOrder(beanAmount, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    // Fill
    function fillPodOrder(
        bytes20 id, 
        uint256 index, 
        uint256 start, 
        uint232 amount, 
        bool toWallet
    ) external  {
        _fillPodOrder(id, index, start, amount, toWallet);
    }

    // Cancel
    function cancelPodOrder(bytes20 id, bool toWallet) external {
        _cancelPodOrder(id, toWallet);
    }

    // Get
    function podOrder(bytes20 id) external view returns (Storage.Order memory) {
       return s.podOrders[id];
    }

    /*
     * Helpers
     */

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, address to) private {
        LibClaim.claim(c);
        LibMarket.allocateBeansTo(transferBeans, to);
    }

    function allocateBeansToWallet(
        LibClaim.Claim calldata c,
        uint256 transferBeans,
        address to,
        bool toWallet
    ) private {
        LibClaim.claim(c);
        LibMarket.allocateBeansToWallet(transferBeans, to, toWallet);
    }

    /*
     * Transfer Plot
     */

     function transferPlot(
         address sender, 
         address recipient, 
         uint256 id, 
         uint256 start, 
         uint256 end
    ) external {
        require(sender != address(0) && recipient != address(0), "Field: Transfer to/from 0 address.");
        uint256 amount = s.a[msg.sender].field.plots[id];
        require(amount > 0, "Field: Plot not owned by user.");
        require(end > start && amount >= end, "Field: Pod range invalid.");
        amount = end.sub(start);
        if (msg.sender != sender && allowancePods(sender, msg.sender) != uint256(-1)) {
                decrementAllowancePods(sender, msg.sender, amount);
        }

        if (s.podListings[id].pricePerPod > 0){
            _cancelPodListing(id);
        }
        _transferPlot(sender, recipient, id, start, amount);
    }

    function approvePods(address spender, uint256 amount) external {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(msg.sender, spender, amount);
        emit PodApproval(msg.sender, spender, amount);
    }
}