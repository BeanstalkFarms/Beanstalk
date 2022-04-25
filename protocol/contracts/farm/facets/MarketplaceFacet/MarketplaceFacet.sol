/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
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
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        bool toWallet
    ) external {
        _createPodListing(index, start, amount, pricePerPod, maxHarvestableIndex, toWallet);
    }

    // Fill
    function fillPodListing(
        PodListing calldata l,
        uint256 beanAmount
    ) external {
        LibMarket.transferBeans(l.account, beanAmount, l.toWallet);
        _fillListing(l, beanAmount);
    }

    function claimAndFillPodListing(
        PodListing calldata l,
        uint256 beanAmount,
        LibClaim.Claim calldata claim
    ) external nonReentrant {
        allocateBeansToWallet(claim, beanAmount, l.account, l.toWallet);
        _fillListing(l, beanAmount);
        LibMarket.claimRefund(claim);
    }

    function buyBeansAndFillPodListing(
        PodListing calldata l,
        uint256 beanAmount,
        uint256 buyBeanAmount
    ) external payable nonReentrant {
        if (beanAmount > 0) LibMarket.transferBeans(l.account, beanAmount, l.toWallet);
        _buyBeansAndFillPodListing(l, beanAmount, buyBeanAmount);
    }

    function claimBuyBeansAndFillPodListing(
        PodListing calldata l,
        uint256 beanAmount,
        uint256 buyBeanAmount,
        LibClaim.Claim calldata claim
    ) external payable nonReentrant {
        allocateBeansToWallet(claim, beanAmount, l.account, l.toWallet);
        _buyBeansAndFillPodListing(l, beanAmount, buyBeanAmount);
    }

    // Cancel
    function cancelPodListing(uint256 index) external {
        _cancelPodListing(index);
    }

    // Get
    function podListing(uint256 index) external view returns (bytes32) {
        return s.podListings[index];
    }

    /*
     * Pod Orders
     */

    // Create
    function createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine
    ) external returns (bytes32 id) {
        bean().transferFrom(msg.sender, address(this), beanAmount);
        return _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimAndCreatePodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine,
        LibClaim.Claim calldata claim
    ) external nonReentrant returns (bytes32 id) {
        allocateBeans(claim, beanAmount, address(this));
        id = _createPodOrder(beanAmount, pricePerPod, maxPlaceInLine);
        LibMarket.claimRefund(claim);
    }

    function buyBeansAndCreatePodOrder(
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine
    ) external nonReentrant payable returns (bytes32 id) {
        if (beanAmount > 0) bean().transferFrom(msg.sender, address(this), beanAmount);
        return _buyBeansAndCreatePodOrder(beanAmount, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    function claimBuyBeansAndCreatePodOrder(
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod,
        uint232 maxPlaceInLine,
        LibClaim.Claim calldata claim
    ) external nonReentrant payable returns (bytes32 id) {
        allocateBeans(claim, beanAmount, address(this));
        return _buyBeansAndCreatePodOrder(beanAmount, buyBeanAmount, pricePerPod, maxPlaceInLine);
    }

    // Fill
    function fillPodOrder(
        PodOrder calldata o,
        uint256 index,
        uint256 start,
        uint256 amount,
        bool toWallet
    ) external {
        _fillPodOrder(o, index, start, amount, toWallet);
    }

    // Cancel
    function cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, bool toWallet) external {
        _cancelPodOrder(pricePerPod, maxPlaceInLine, toWallet);
    }

    // Get

    function podOrder(address account, uint24 pricePerPod, uint256 maxPlaceInLine) external view returns (uint256) {
        return s.podOrders[createOrderId(account, pricePerPod, maxPlaceInLine)];
    }

    function podOrderById(bytes32 id) external view returns (uint256) {
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
    ) external nonReentrant {
        require(sender != address(0) && recipient != address(0), "Field: Transfer to/from 0 address.");
        uint256 amount = s.a[msg.sender].field.plots[id];
        require(amount > 0, "Field: Plot not owned by user.");
        require(end > start && amount >= end, "Field: Pod range invalid.");
        amount = end - start; // Note: SafeMath is redundant here.
        if (msg.sender != sender && allowancePods(sender, msg.sender) != uint256(-1)) {
                decrementAllowancePods(sender, msg.sender, amount);
        }

        if (s.podListings[id] != bytes32(0)){
            _cancelPodListing(id);
        }
        _transferPlot(sender, recipient, id, start, amount);
    }

    function approvePods(address spender, uint256 amount) external nonReentrant {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(msg.sender, spender, amount);
        emit PodApproval(msg.sender, spender, amount);
    }
}