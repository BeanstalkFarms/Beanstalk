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
import "hardhat/console.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/

contract Marketplace {

    using SafeMath for uint256;

    AppStorage internal s;

    event ListingCreated(address indexed account, uint256 index, uint24 pricePerPod, uint232 expiry, uint256 amount);
    event ListingCancelled(address indexed account, uint256 index);
    event ListingFilled(address indexed from, address indexed to, uint256 index, uint24 pricePerPod, uint256 amount);
    event BuyOfferCreated(uint indexed index, address indexed account, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
    event BuyOfferCancelled(address indexed account, uint256 index);
    event BuyOfferFilled(address indexed from, address indexed to, uint24 buyOfferIndex, uint256 index, uint24 pricePerPod, uint256 amount);
    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);

    function __buyListing(uint256 index, address from, uint256 amount) internal {
        _fillListing(from, msg.sender, index, amount);
        _transferPlot(from, msg.sender, index, 0, amount);
    }

    function _fillListing(address from, address to, uint256 index, uint256 amount) internal {
        require(s.a[from].field.plots[index] >= amount, "Marketplace: Plot has insufficient amount.");
        Storage.Listing storage listing = s.listedPlots[index];
        uint24 price = listing.price;
        uint256 listingAmount = listing.amount;
        if (listingAmount == 0){
            listingAmount = s.a[from].field.plots[index];
        }
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= listing.expiry, "Marketplace: Listing has expired");
        require(listingAmount >= amount, "Marketplace: Not enough pods in listing");

        if (amount >= listingAmount){
            amount = listingAmount;
        }
        else{
            s.listedPlots[index.add(amount)] = listing;
            // Optimization: if Listing is full amount of plot, set amount to 0
            // Later, we consider a valid Listing (price>0) with amount 0 to be full amount of plot
            if (listingAmount == s.a[from].field.plots[index]){
                s.listedPlots[index.add(amount)].amount = 0;
            }
            else{
                s.listedPlots[index.add(amount)].amount = listingAmount - amount;
            }
        }
        delete s.listedPlots[index];
        emit ListingFilled(from, to, index, price, amount);

    }
    
    function _transferPlot(address from, address to, uint256 index, uint256 start, uint256 amount) internal {
        require(from != address(0), "Marketplace: Transfer from 0 address.");
        require(to != address(0), "Marketplace: Transfer to 0 address.");
        insertPlot(to,index.add(start),amount);
        removePlot(from,index,start,amount.add(start));
        emit PlotTransfer(from, to, index.add(start), amount);
    }

    function __listBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amount) internal {
        require(amount > 0, "Marketplace: Must offer to buy non-zero amount");
        s.buyOffers[s.buyOfferIndex].amount = amount;
        s.buyOffers[s.buyOfferIndex].price = pricePerPod;
        s.buyOffers[s.buyOfferIndex].maxPlaceInLine = maxPlaceInLine;
        s.buyOffers[s.buyOfferIndex].owner = msg.sender;
        emit BuyOfferCreated(s.buyOfferIndex, msg.sender, amount, pricePerPod, maxPlaceInLine);
        s.buyOfferIndex = s.buyOfferIndex + 1;
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
}
