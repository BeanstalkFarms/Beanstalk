/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibClaim.sol";
import "../FieldFacet/FieldFacet.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/

contract Marketplace {

    using SafeMath for uint256;

    AppStorage internal s;
    // event ListingCreated(address indexed account, uint256 index, uint256 distanceFromBack, uint256 amount, uint24 pricePerPod, uint232 expiry);
    // event ListingCancelled(address indexed account, uint256 index);
    // event ListingFilled(address indexed from, address indexed to, uint256 index, uint256 amount, uint24 pricePerPod);
    // event PodOrderCreated(address indexed account, bytes20 podOrderIndex, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
    // event PodOrderCancelled(address indexed account, bytes20 podOrderIndex);
    // event PodOrderFilled(address indexed from, address indexed to, bytes20 podOrderIndex, uint256 index, uint256 amount, uint24 pricePerPod);

    event PodListingCreated(address indexed account, uint256 plotIndex, uint256 amount, uint256 distanceFromBack, uint24 pricePerPod, uint232 expiry);
    event PodListingCancelled(address indexed account, uint256 plotIndex);
    event PodListingFilled(address indexed from, address indexed to, uint256 plotIndex, uint256 amount, uint256 distanceFromBack, uint24 pricePerPod);
    event PodOrderCreated(address indexed account, bytes20 podOrderIndex, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
    event PodOrderCancelled(address indexed account, bytes20 podOrderIndex);
    event PodOrderFilled(address indexed from, address indexed to, bytes20 podOrderIndex, uint256 plotIndex, uint256 amount, uint24 pricePerPod);
    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);

    function __buyListing(address from, uint256 index, uint256 distanceFromBack, uint256 amount) internal {
        uint256 listingAmount = s.podListings[index].amount;
        if (listingAmount == 0){
            listingAmount = s.a[from].field.plots[index];
        }
        _fillListing(from, msg.sender, index, distanceFromBack, amount, listingAmount);
        _transferPlot(from, msg.sender, index, s.a[from].field.plots[index].sub(distanceFromBack + listingAmount), amount);
    }

    function _fillListing(address from, address to, uint256 index, uint256 distanceFromBack, uint256 amount, uint256 listingAmount) internal {
        uint256 plotAmount = s.a[from].field.plots[index];
        require(plotAmount >= amount, "Marketplace: Plot has insufficient amount.");
        Storage.Listing storage listing = s.podListings[index];
        require(distanceFromBack == listing.distanceFromBack, "Marketplace: Invalid listing distanceFromBack.");
        uint24 price = listing.price;
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= listing.expiry, "Marketplace: Listing has expired");
        require(listingAmount >= amount, "Marketplace: Not enough pods in listing");
        if (listingAmount > amount) {
            s.podListings[index.add(amount).add(distanceFromBack)] = listing;
            // Optimization: if Listing is full amount of plot, set amount to 0
            // Later, we consider a valid Listing (price>0) with amount 0 to be full amount of plot
            if (listingAmount == plotAmount){
                s.podListings[index.add(amount).add(distanceFromBack)].amount = 0;
            }
            else{
                s.podListings[index.add(amount).add(distanceFromBack)].amount = listingAmount - amount;
            }
        }
        delete s.podListings[index];
        emit PodListingFilled(from, to, index, amount, distanceFromBack, price);
    }

    function _transferPlot(address from, address to, uint256 index, uint256 start, uint256 amount) internal {
        insertPlot(to,index.add(start),amount);
        removePlot(from,index,start,amount.add(start));
        emit PlotTransfer(from, to, index.add(start), amount);
    }

    function __listOrder(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amount) internal  returns (bytes20 podOrderId) {
        require(amount > 0, "Marketplace: Must offer to buy non-zero amount");
        bytes20 podOrderId = createPodOrderId();
        s.podOrders[podOrderId].amount = amount;
        s.podOrders[podOrderId].price = pricePerPod;
        s.podOrders[podOrderId].maxPlaceInLine = maxPlaceInLine;
        s.podOrders[podOrderId].owner = msg.sender;
        emit PodOrderCreated(msg.sender, podOrderId, amount, pricePerPod, maxPlaceInLine);
        return podOrderId;
    }

    function insertPlot(address account, uint256 id, uint256 amount) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(address account, uint256 id, uint256 start, uint256 end) internal {
        uint256 amount = s.a[account].field.plots[id];
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount) s.a[account].field.plots[id.add(end)] = amount.sub(end);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }

    function createPodOrderId() internal returns (bytes20 podOrderId) {
        // Generate the Buy Offer Id from sender + block hash
        podOrderId = bytes20(keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1))));
        // Make sure this podOrderId has not been used before (could be in the same block).
        while (s.podOrders[podOrderId].price != 0) {
            podOrderId = bytes20(keccak256(abi.encodePacked(podOrderId)));
        }
        return podOrderId;
    }
}
