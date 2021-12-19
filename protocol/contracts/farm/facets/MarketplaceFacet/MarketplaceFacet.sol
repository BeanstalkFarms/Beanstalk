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

    // Question Publius

    // whats the point of indexing if were going to need every individual event for the entire marketplace data
    // for partials ETC



    event ListingCreated(address indexed account, uint256 indexed index, uint24 pricePerPod, uint232 expiry, uint256 amount);
    event ListingCancelled(address indexed account, uint256 indexed index);
    event ListingFilled(address indexed buyer, address indexed seller, uint256 indexed index, uint24 pricePerPod, uint256 amount);

    event BuyOfferCreated(uint indexed index, address indexed account, uint232 amount, uint24 pricePerPod, uint256 maxPlaceInLine);
    event BuyOfferCancelled(address indexed account, uint256 indexed index);
    event BuyOfferFilled(uint256 indexed index, uint256 amount);

    event PlotTransfer(address indexed buyer, address indexed seller, uint256 indexed index, uint24 pricePerPod, uint256 amount);


    function insertPlot(address account, uint256 id, uint256 amount) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(address account, uint256 id, uint256 start, uint256 end) internal {
        uint256 amount = s.a[account].field.plots[id];
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount) s.a[account].field.plots[id.add(end)] = amount.sub(end);
    }
    
    function listPlot(uint256 index, uint24 pricePerPod, uint232 expiry, uint256 amount) public {
    
        uint256 plotSize = s.a[msg.sender].field.plots[index];

        require(plotSize > 0, "Field: Plot not owned by user.");
        require(plotSize >= amount, "Field: Plot not large enough.");

        // Optimization: if Listing is full amount of plot, set to 0
        // Later, we consider a Listing with 0 to be full plot
        if (amount == plotSize){
            s.listedPlots[index].amount = 0;
        }
        else{
            s.listedPlots[index].amount = amount;
        }
        s.listedPlots[index].expiry = expiry;
        s.listedPlots[index].price = pricePerPod;

        emit ListingCreated(msg.sender, index, pricePerPod, expiry, amount);
    }

    function listing (uint256 index) public view returns (Storage.Listing memory) {
       return s.listedPlots[index];
    }

    function buyListing(uint index, address recipient, uint amount) public {


        Storage.Listing storage listing = s.listedPlots[index];
        uint232 harvestable = uint232(s.f.harvestable);

        uint256 listingAmount = s.listedPlots[index].amount;

        if (listingAmount == 0){
            listingAmount = s.a[recipient].field.plots[index];
        }

        require(msg.sender != address(0), "Field: Transfer from 0 address.");
        require(recipient != address(0), "Field: Transfer to 0 address.");
        require(harvestable <= listing.expiry, "Field: Listing has expired");
        require(listingAmount >= amount, "Field: Plot Listing has insufficient pods");
 
        uint costInBeans = (listing.price * amount) / 1000000;

        require(bean().balanceOf(msg.sender) >= costInBeans, "Field: Not enough beans to purchase.");
        bean().transferFrom(msg.sender, recipient, costInBeans);
        insertPlot(msg.sender,index,amount);
        removePlot(recipient,index,0,amount);

        if (amount == listingAmount) delete s.listedPlots[index];
        else{
            s.listedPlots[index.add(amount)] = s.listedPlots[index];
            delete s.listedPlots[index];
        }

        emit ListingFilled(msg.sender, recipient, index, listing.price, amount);
        emit PlotTransfer(msg.sender, recipient, index, listing.price, amount);
    }

    // TODO Test: How to include ETH value in test call
    function buyBeansAndListing(uint index, address recipient, uint amount, uint256 buyBeanAmount) public {

        LibMarket.buy(buyBeanAmount);
        buyListing(index, recipient, amount);
    }

    function cancelListing(uint index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Field: Plot not owned by user.");
        delete s.listedPlots[index];
        emit ListingCancelled(msg.sender, index);
    }


    // TODO
    // Question for Publius: Include 3 different amounts here?
    // Question for Publius: allocateBeans? 
    // function claimBeansAndBuyListing(uint256 amount, LibClaim.Claim calldata claim, uint index, address payable recipient, uint buyBeanAmount, uint amountToClaim) public  {
    //     FieldFacet.allocateBeans(claim, amountToClaim);
    //     buyBeansAndListing(index,recipient,amount);
    // }

    function listBuyOffer(uint256 maxPlaceInLine, uint24 maxPricePerPod, uint232 amount) public  {
        
        s.buyOffers[s.buyOfferIndex].amount = amount;
        s.buyOffers[s.buyOfferIndex].price = maxPricePerPod;
        s.buyOffers[s.buyOfferIndex].maxPlaceInLine = maxPlaceInLine;
        s.buyOffers[s.buyOfferIndex].owner = msg.sender;

        uint costInBeans = (maxPricePerPod * amount) / 1000000;
        require(bean().balanceOf(msg.sender) >= costInBeans, "Field: Not enough beans to submit buy offer.");

        bean().transferFrom(msg.sender, address(this), costInBeans);
        emit BuyOfferCreated(s.buyOfferIndex, msg.sender, amount, maxPricePerPod, maxPlaceInLine);

        s.buyOfferIndex = s.buyOfferIndex + 1;

    }

    function sellToBuyOffer(uint256 plotIndex, uint24 buyOfferIndex, uint232 amount) public  {
        
        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];
        require(amount <= buyOffer.amount, "Field: Buy Offer has insufficient pods");
        require(s.a[msg.sender].field.plots[plotIndex] >= amount, "Field: Plot cannot fill Buy Offer.");

        uint256 costInBeans = (buyOffer.price * amount) / 1000000;

        bean().transferFrom(address(this), msg.sender, costInBeans);

        // If plot being transferred was previously listed,
        // Update Index / Delete Listing Accordingly 
        if (s.listedPlots[plotIndex].price > 0){
            Storage.Listing storage listing = s.listedPlots[plotIndex];
            uint256 listingAmount = listing.amount;
            if (listingAmount == 0){
                listingAmount = s.a[msg.sender].field.plots[plotIndex];
            }
            if (amount == listingAmount){
                delete s.listedPlots[plotIndex];
            }
            else{
                s.listedPlots[plotIndex.add(amount)] = s.listedPlots[plotIndex];
                delete s.listedPlots[plotIndex];
            }
            emit ListingFilled(buyOffer.owner, msg.sender, plotIndex, listing.price, amount);
        }

        insertPlot(buyOffer.owner,plotIndex,amount);
        removePlot(msg.sender,plotIndex,0,amount);

        buyOffer.amount = buyOffer.amount - amount;

        emit PlotTransfer(msg.sender, buyOffer.owner, plotIndex, buyOffer.price, amount);
        emit BuyOfferFilled(buyOfferIndex, amount);

    }


    function cancelOffer(uint24 buyOfferIndex) public  {
        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];
        // TODO does this check equality correctly?
        require(buyOffer.owner == msg.sender, "Field: Buy Offer not owned by user.");
        delete s.buyOffers[buyOfferIndex];
        emit BuyOfferCancelled(msg.sender, buyOfferIndex);
    }

    

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}
