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

contract MarketplaceFacet {

    using SafeMath for uint256;

    AppStorage s;

    event ListingCreated(address indexed account, uint256 indexed index, uint24 pricePerPod, uint232 expiry);
    event PlotTransfer(address indexed buyer, address indexed seller, uint256 indexed index, uint24 pricePerPod, uint256 amount);
    event ListingCancelled(address indexed account, uint256 indexed index);


    function insertPlot(address account, uint256 id, uint256 amount) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(address account, uint256 id, uint256 start, uint256 end) internal {
        uint256 amount = s.a[account].field.plots[id];
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount) s.a[account].field.plots[id.add(end)] = amount.sub(end);
    }
    
    function listPlot(uint index, uint24 pricePerPod, uint232 harvestExpiration) public {
    
        require(s.a[msg.sender].field.plots[index] > 0, "Field: Plot not owned by user.");
        require(pricePerPod > 0);

        uint232 expiry = uint232(s.f.harvestable.add(harvestExpiration));

        s.listedPlots[index].expiry = expiry;
        s.listedPlots[index].price = pricePerPod;

        emit ListingCreated(msg.sender, index, pricePerPod, expiry);
    }

    function listing (uint256 index) public view returns (Storage.Listing memory) {
       return s.listedPlots[index];
    }

    // change such that the buy supports partial buys of plots
    // so add "amount" parameter and use that as purchase amount,
    // transfering partial plots and emitting such event
    // do the same with buyListingWithEth
    function buyListing(uint index, address recipient, uint amount) public {


        Storage.Listing storage listing = s.listedPlots[index];
        uint232 harvestable = uint232(s.f.harvestable);

        uint plotSize = s.a[recipient].field.plots[index];

        require(msg.sender != address(0), "Field: Transfer from 0 address.");
        require(recipient != address(0), "Field: Transfer to 0 address.");
        require(harvestable <= listing.expiry, "Field: Listing has expired");
        require(plotSize >= amount, "Field: Pod range too long.");

        uint costInBeans = (listing.price * amount) / 1000000;
        require(bean().balanceOf(msg.sender) >= costInBeans, "Field: Not enough beans to purchase.");

        bean().transferFrom(msg.sender, recipient, costInBeans);

        insertPlot(msg.sender,index,amountPods);
        removePlot(recipient,index,0,amountPods);

        // only delete if amount = plotSize
        // else adjust the index - dont know how to handle this on frontend just yet
        // if plotTransfer index = listing index on frontend
        // can adjust the amount sold and the index
        // delete s.listedPlots[index];

        emit PlotTransfer(msg.sender, recipient, index, msg.value, amount);
       
    }
    

    function buyBeansAndListing(uint index, address payable recipient, uint amount, uint buyBeanAmount) public {

        Storage.Listing storage listing = s.listedPlots[index];
        (uint256 ethAmount, uint256 beanAmount) = LibMarket._buy(buyBeanAmount, msg.value, recipient);
        (bool success,) = msg.sender.call{ value: msg.value.sub(ethAmount) }("");
        require(success, "Market: Refund failed.");

        buyListing(index, recipient, amount);
    }

    function cancelListing(uint index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Field: Plot not owned by user.");
        delete s.listedPlots[index];
        emit ListingCancelled(msg.sender, index);
    }

    function buyBeansAndListing(uint256 amount, LibClaim.Claim calldata claim, uint index, address payable recipient) public  {
        FieldFacet.allocateBeans(claim, amount);
        buyListingWithBeans(index,recipient);
    }


    // Buy offers are the other side to the marketplace, in which a user an list
    // an offer to buy, and then users can fill this buy with their plots


    // functionlistBuyOffer(uint256 maxPlaceInLine, uint24 maxPricePerPod, uint232 maxAmountPods) public  {
        // require
        // s.buyOffers[s.buyOfferIndex].maxAmountPods = maxAmountPods;
        // s.buyOffers[s.buyOfferIndex].price = maxPricePerPod;
        // s.buyOffers[s.buyOfferIndex].maxPlaceInLine = maxPlaceInLine;
        // s.buyOfferIndex = s.buyOfferIndex + 1;
    // }

    // function cancelOffer() public  {

    // }

    // function meetBuyOffer() public  {

    // }
    

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}
