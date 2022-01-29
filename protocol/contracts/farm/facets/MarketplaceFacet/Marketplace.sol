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

    event PodListingCreated(address indexed account, uint256 index, uint256 start, uint256 amount, uint24 pricePerPod, uint232 maxHarvestableIndex, bool toWallet);
    event PodListingCancelled(address indexed account, uint256 index);
    event PodListingFilled(address indexed from, address indexed to, uint256 index, uint256 start, uint256 amount, uint24 pricePerPod);
    event PodOrderCreated(address indexed account, bytes20 orderId, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
    event PodOrderCancelled(address indexed account, bytes20 orderId);
    event PodOrderFilled(address indexed from, address indexed to, bytes20 podOrderIndex, uint256 plotIndex, uint256 amount, uint24 pricePerPod);
    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);

    function _buyListing(address from, uint256 index, uint256 start, uint256 amountBeans, uint24 pricePerPod) internal {
        Storage.Listing storage l = s.podListings[index];
        require(l.price > 0, "Marketplace: Listing does not exist.");
        require(start == l.start && l.price == pricePerPod, "Marketplace: start/price must match listing.");
        require(uint232(s.f.harvestable) <= l.maxHarvestableIndex, "Marketplace: Listing has expired");

        uint256 amount = (amountBeans * 1000000) / l.price;
        amount = roundAmount(from, index, start, amount, l.price);

        _fillListing(from, msg.sender, index, start, amount);
        _transferPlot(from, msg.sender, index, start, amount);
    }

    // If remainder left (always <1 pod) that would otherwise be unpurchaseable
    // due to rounding from calculating amount, give it to last buyer
    function roundAmount(address from, uint256 index, uint256 start, uint256 amount, uint24 price) view public returns (uint256) {
        uint256 listingAmount = s.podListings[index].amount;
        if (listingAmount == 0) listingAmount = s.a[from].field.plots[index].sub(start);

        if ((listingAmount - amount) < (1000000 / price))
            amount = listingAmount;
        return amount;
    }

    function _fillListing(address from, address to, uint256 index, uint256 start, uint256 amount) internal {
        Storage.Listing storage l = s.podListings[index];

        uint256 lAmount = l.amount;
        if (lAmount == 0) lAmount = s.a[from].field.plots[index].sub(s.podListings[index].start);
        require(lAmount >= amount, "Marketplace: Not enough pods in listing.");

        if (lAmount > amount) {
            uint256 newIndex = index.add(amount).add(start);
            s.podListings[newIndex] = l;
            if (l.amount != 0) {
                s.podListings[newIndex].amount = uint128(lAmount - amount);
            }
        }
        delete s.podListings[index];
        emit PodListingFilled(from, to, index, start, amount, l.price);
    }

    function _transferPlot(address from, address to, uint256 index, uint256 start, uint256 amount) internal {
        insertPlot(to,index.add(start),amount);
        removePlot(from,index,start,amount.add(start));
        emit PlotTransfer(from, to, index.add(start), amount);
    }

    function __listOrder(uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine) internal  returns (bytes20 podOrderId) {
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
