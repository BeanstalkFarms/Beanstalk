/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibClaim.sol";
import "./PodTransfer.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/
contract Listing is PodTransfer {

    using SafeMath for uint256;

    event PodListingCreated(
        address indexed account, 
        uint256 index, 
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint232 maxHarvestableIndex, 
        bool toWallet
    );
    event PodListingFilled(
        address indexed from, 
        address indexed to, 
        uint256 index, 
        uint256 start, 
        uint256 amount
    );
    event PodListingCancelled(address indexed account, uint256 index);

    /*
     * Create
     */

    function _createPodListing(
        uint256 index, 
        uint128 start, 
        uint128 amount, 
        uint24 pricePerPod, 
        uint224 maxHarvestableIndex, 
        bool toWallet
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        if (s.podListings[index].pricePerPod > 0){
            _cancelPodListing(index);
        }

        s.podListings[index].start = start;
        if (plotSize > amount) s.podListings[index].amount = amount;
        s.podListings[index].pricePerPod = pricePerPod;
        s.podListings[index].maxHarvestableIndex = maxHarvestableIndex;
        s.podListings[index].toWallet = toWallet;

        emit PodListingCreated(msg.sender, index,  start, amount, pricePerPod, maxHarvestableIndex, toWallet);
    }

    /*
     * Fill
     */

    function _buyBeansAndFillPodListing(
        address from,
        uint256 index,
        uint256 start,
        uint256 beanAmount,
        uint256 buyBeanAmount,
        uint24 pricePerPod
    ) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokensToWallet(
            buyBeanAmount, 
            from, 
            s.podListings[index].toWallet
        );
        _fillListing(from, index, start, beanAmount+buyBeanAmount, pricePerPod);
    }

    function _fillListing(
        address from,
        uint256 index,
        uint256 start,
        uint256 beanAmount,
        uint24 pricePerPod
    ) internal {
        Storage.Listing storage l = s.podListings[index];
        require(l.pricePerPod > 0, "Marketplace: Listing does not exist.");
        require(start == l.start && l.pricePerPod == pricePerPod, "Marketplace: start/price must match listing.");
        require(uint232(s.f.harvestable) <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = (beanAmount * 1000000) / l.pricePerPod;
        amount = roundAmount(from, index, start, amount, l.pricePerPod);

        __fillListing(from, msg.sender, index, start, amount);
        _transferPlot(from, msg.sender, index, start, amount);
    }

    function __fillListing(
        address from, 
        address to, 
        uint256 index, 
        uint256 start, 
        uint256 amount
    ) private {
        Storage.Listing storage l = s.podListings[index];

        uint256 lAmount = l.amount;
        if (lAmount == 0) lAmount = s.a[from].field.plots[index].sub(s.podListings[index].start);
        require(lAmount >= amount, "Marketplace: Not enough pods in Listing.");

        if (lAmount > amount) {
            uint256 newIndex = index.add(amount);
            s.podListings[newIndex] = l;
            if (l.amount != 0) {
                s.podListings[newIndex].amount = uint128(lAmount - amount);
            }
        }
        emit PodListingFilled(from, to, index, start, amount);
        delete s.podListings[index];
    }

    /*
     * Cancel
     */

    function _cancelPodListing(uint256 index) internal {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Listing not owned by sender.");
        delete s.podListings[index];
        emit PodListingCancelled(msg.sender, index);
    }

    /*
     * Helpers
     */

    // If remainder left (always <1 pod) that would otherwise be unpurchaseable
    // due to rounding from calculating amount, give it to last buyer
    function roundAmount(
        address from,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 price
    ) view private returns (uint256) {
        uint256 listingAmount = s.podListings[index].amount;
        if (listingAmount == 0) listingAmount = s.a[from].field.plots[index].sub(start);

        if ((listingAmount - amount) < (1000000 / price))
            amount = listingAmount;
        return amount;
    }
}