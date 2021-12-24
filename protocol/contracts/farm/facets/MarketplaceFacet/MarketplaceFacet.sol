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

contract MarketplaceFacet {

    using SafeMath for uint256;

    AppStorage s;

    // Question Publius

    // whats the point of indexing if were going to need every individual event for the entire marketplace data
    // for partials ETC

    event ListingCreated(address indexed account, uint256 indexed index, uint24 pricePerPod, uint232 expiry, uint256 amount);
    event ListingCancelled(address indexed account, uint256 indexed index);
    event ListingFilled(address indexed buyer, address indexed seller, uint256 indexed index, uint24 pricePerPod, uint256 amount);

    event BuyOfferCreated(uint indexed index, address indexed account, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
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

        require(plotSize >= amount, "Marketplace: Plot not large enough.");

        require(pricePerPod > 0, "Marketplace: Plot price must be non-zero.");
        require(pricePerPod < 1000000, "Marketplace: Plot price must be less than 1.");

        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= index, "Marketplace: Plot cannot be harvestable.");
        require(expiry <= index, "Marketplace: Plot must expire before harvestable.");
        require(s.listedPlots[index].price == 0, "Marketplace: Plot already listed.");

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

    function buyListing(uint256 index, address recipient, uint256 amountBeansUsing) public {

        Storage.Listing storage listing = s.listedPlots[index];

        require(listing.price > 0, "Marketplace: Plot not listed.");
        uint232 harvestable = uint232(s.f.harvestable);

        uint256 listingAmount = s.listedPlots[index].amount;

        if (listingAmount == 0){
            listingAmount = s.a[recipient].field.plots[index];
        }

        uint256 amount = (amountBeansUsing  * 1000000) /listing.price;

        // In case of slippage impacting bean purchase in positive way
        if (listingAmount < amount){
            amount = listingAmount;
            amountBeansUsing = (amount * listing.price)/1000000;
        }

        require(bean().balanceOf(msg.sender) >= amountBeansUsing, "Field: Not enough beans to purchase.");

        require(msg.sender != address(0), "Marketplace: Transfer from 0 address.");
        require(recipient != address(0), "Marketplace: Transfer to 0 address.");
        require(harvestable <= listing.expiry, "Marketplace: Listing has expired");
 
        bean().transferFrom(msg.sender, recipient, amountBeansUsing);
        insertPlot(msg.sender,index,amount);
        removePlot(recipient,index,0,amount);

        if (amount == listingAmount) delete s.listedPlots[index];
        else{
            s.listedPlots[index.add(amount)] = s.listedPlots[index];
            s.listedPlots[index.add(amount)].amount = listingAmount - amount;
            delete s.listedPlots[index];
        }

        emit ListingFilled(msg.sender, recipient, index, listing.price, amount);
        emit PlotTransfer(msg.sender, recipient, index, listing.price, amount);
    }

    //TODO Test: How to include ETH value in test call
    function buyBeansAndListing(uint256 index, address recipient, uint256 amountBeans, uint256 buyBeanAmount) public payable {
        uint256 boughtBeanAmount = LibMarket.buy(buyBeanAmount);
        buyListing(index, recipient, boughtBeanAmount + amountBeans);
    }

    function cancelListing(uint256 index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Plot not owned by user.");
        delete s.listedPlots[index];
        emit ListingCancelled(msg.sender, index);
    }


    // TODO
    // function claimBeansAndBuyListing(uint256 amount, LibClaim.Claim calldata claim, uint index, address payable recipient, uint buyBeanAmount, uint amountToClaim) public  {
    //     FieldFacet.allocateBeans(claim, amountToClaim);
    //     buyBeansAndListing(index,recipient,amount);
    // }

    function listBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeansUsing) public  {

        
        require(amountBeansUsing > 0, "Marketplace: Must offer to buy non-zero amount");
        require(bean().balanceOf(msg.sender) >= amountBeansUsing, "Marketplace: Not enough beans to submit buy offer.");
        require(pricePerPod > 0, "Marketplace: Price must be greater than 0");

        uint256 amount = (amountBeansUsing  * 1000000) / pricePerPod;

        s.buyOffers[s.buyOfferIndex].amount = amount;
        s.buyOffers[s.buyOfferIndex].price = pricePerPod;
        s.buyOffers[s.buyOfferIndex].maxPlaceInLine = maxPlaceInLine;
        s.buyOffers[s.buyOfferIndex].owner = msg.sender;

        bean().transferFrom(msg.sender, address(this), amountBeansUsing);

        emit BuyOfferCreated(s.buyOfferIndex, msg.sender, amount, pricePerPod, maxPlaceInLine);

        s.buyOfferIndex = s.buyOfferIndex + 1;

    }

    function buyBeansAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) public payable{
        console.log('bean().balanceOf(msg.sender) before',bean().balanceOf(address(this)));
        uint256 boughtBeanAmount = LibMarket.buyAndDeposit(buyBeanAmount);
        console.log('bean().balanceOf(msg.sender) after',bean().balanceOf(address(this)));
        console.log('boughtBeanAmount',boughtBeanAmount);
        listBuyOffer(maxPlaceInLine, pricePerPod, boughtBeanAmount + amountBeans);
    }


    function sellToBuyOffer(uint256 plotIndex, uint24 buyOfferIndex, uint232 amount) public  {
        
        require(s.a[msg.sender].field.plots[plotIndex] >= 0, "Marketplace: Plot  not owned by user.");

        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];


        uint232 harvestable = uint232(s.f.harvestable);
        uint256 placeInLine = plotIndex + amount - harvestable;
        require(placeInLine <= buyOffer.maxPlaceInLine, "Marketplace: Plot too far in line");

        require(buyOffer.price > 0, "Marketplace: BuyOffer does not exist");

        require(amount <= buyOffer.amount, "Marketplace: Buy Offer has insufficient amount.");
        require(s.a[msg.sender].field.plots[plotIndex] >= amount, "Marketplace: Plot has insufficient amount.");

        uint256 costInBeans = (buyOffer.price * amount) / 1000000;

        bean().transfer(msg.sender, costInBeans);

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
                s.listedPlots[plotIndex.add(amount)] = listing;
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

    function cancelBuyOffer(uint24 buyOfferIndex) public  {
        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];
        // TODO does this check equality correctly?
        require(buyOffer.owner == msg.sender, "Field: Buy Offer not owned by user.");
        
        uint256 amount = s.buyOffers[s.buyOfferIndex].amount;
        uint256 price = s.buyOffers[s.buyOfferIndex].price;

        uint256 costInBeans = (price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        
        delete s.buyOffers[buyOfferIndex];
        emit BuyOfferCancelled(msg.sender, buyOfferIndex);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}
