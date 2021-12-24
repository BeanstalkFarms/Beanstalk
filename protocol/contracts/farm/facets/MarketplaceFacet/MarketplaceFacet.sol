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

    //TODO 
    // whats the point of indexing if were going to need every individual event for the entire marketplace data
    // for partials ETC

    event ListingCreated(address indexed account, uint256 indexed index, uint24 pricePerPod, uint232 expiry, uint256 amount);
    event ListingCancelled(address indexed account, uint256 indexed index);
    // TODO  does listingfilled need buyer?
    event ListingFilled(address indexed buyer, address indexed seller, uint256 indexed index, uint24 pricePerPod, uint256 amount);

    event BuyOfferCreated(uint indexed index, address indexed account, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
    event BuyOfferCancelled(address indexed account, uint256 indexed index);
    event BuyOfferFilled(uint256 indexed index, uint256 amount);

    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);



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

    // QUESTION Is this code inefficient because we save listing to memory, and then make another call where we save it to storage
    // in _buyListing() we do: Storage.Listing storage listing = s.listedPlots[index];
    // We do this to reuse code between functions but we also now make two calls to memory instead of 1
    // We could copy and past the _buyListing code in each function and we wouldnt make two calls to s.listedPlots[index]
    // should we make the code more messy / less modular if it means we can save gas by making less memory retrievals? 
    function buyListing(uint256 index, address recipient, uint256 amountBeansUsing) public {
        
        Storage.Listing memory listing = s.listedPlots[index];
        uint256 amount = (amountBeansUsing  * 1000000) / listing.price;
        bean().transferFrom(msg.sender, recipient, amountBeansUsing);
        _buyListing(index,recipient,amount);
    }

    function buyBeansAndListing(uint256 index, address recipient, uint256 amountBeans, uint256 buyBeanAmount) public payable {

        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount);
        if (amountBeans > 0) bean().transferFrom(msg.sender, address(this), amount);
        Storage.Listing memory listing = s.listedPlots[index];
        uint256 amount = ((amountBeans + buyBeanAmount)  * 1000000) / listing.price;
        _buyListing(index,recipient,amount);
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

    function buyBeansAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) public payable {

        require(bean().balanceOf(msg.sender) >= amountBeans, "Marketplace: Not enough beans to submit buy offer.");
        require(pricePerPod > 0, "Marketplace: Price must be greater than 0");

        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount);

        uint256 amountBeansUsing = boughtBeanAmount + amountBeans;
        require(amountBeansUsing > 0, "Marketplace: Must offer to buy non-zero amount");

        uint256 amount = (amountBeansUsing  * 1000000) / pricePerPod;

        s.buyOffers[s.buyOfferIndex].amount = amount;
        s.buyOffers[s.buyOfferIndex].price = pricePerPod;
        s.buyOffers[s.buyOfferIndex].maxPlaceInLine = maxPlaceInLine;
        s.buyOffers[s.buyOfferIndex].owner = msg.sender;

        bean().transferFrom(msg.sender, address(this), amountBeans);

        emit BuyOfferCreated(s.buyOfferIndex, msg.sender, amount, pricePerPod, maxPlaceInLine);

        console.log('bean().balanceOf(msg.sender) after',bean().balanceOf(address(this)));

    }


    function sellToBuyOffer(uint256 plotIndex, uint24 buyOfferIndex, uint232 amount) public  {
        
        require(s.a[msg.sender].field.plots[plotIndex] >= 0, "Marketplace: Plot  not owned by user.");



        uint232 harvestable = uint232(s.f.harvestable);
        require(plotIndex >= harvestable, "Marketplace: Cannot send harvestable plot");

        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];
        uint256 placeInLine = plotIndex + amount - harvestable;

        require(placeInLine <= buyOffer.maxPlaceInLine, "Marketplace: Plot too far in line");
        require(buyOffer.price > 0, "Marketplace: Buy Offer does not exist");
        require(amount <= buyOffer.amount, "Marketplace: Buy Offer has insufficient amount.");

        uint256 costInBeans = (buyOffer.price * amount) / 1000000;

        bean().transfer(msg.sender, costInBeans);

        // If plot being transferred was previously listed,
        // Update Index / Delete Listing Accordingly 
        if (s.listedPlots[plotIndex].price > 0){
            _fillListing(plotIndex, amount, buyOffer.owner,msg.sender, true);

            // Storage.Listing storage listing = s.listedPlots[plotIndex];

            // uint256 listingAmount = listing.amount;
            // if (listingAmount == 0){
            //     listingAmount = s.a[msg.sender].field.plots[plotIndex];
            // }
            // if (amount == listingAmount){
            //     delete s.listedPlots[plotIndex];
            // }
            // else{
            //     s.listedPlots[plotIndex.add(amount)] = listing;
            //     s.listedPlots[plotIndex.add(amount)].amount = listingAmount - amount;
            //     delete s.listedPlots[plotIndex];
            // }
            // emit ListingFilled(buyOffer.owner, msg.sender, plotIndex, listing.price, amount);


        }

        buyOffer.amount = buyOffer.amount - amount;

        _transferPlot(msg.sender, buyOffer.owner, plotIndex, amount);

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



    function _buyListing(uint256 index, address recipient, uint256 amount) private {

        _fillListing(index, amount, msg.sender, recipient, false);
        _transferPlot(msg.sender, recipient, index, amount);

    }

    function _fillListing(uint256 index, uint256 amount, address buyer, address seller, bool isSendingOwnListing) private {

        Storage.Listing storage listing = s.listedPlots[index];
        require(s.a[recipient].field.plots[plotIndex] >= amount, "Marketplace: Plot has insufficient amount.");

        uint256 listingAmount = listing.amount;
        if (listingAmount == 0){
            listingAmount = s.a[msg.sender].field.plots[index];
        }

        if (!isSendingOwnListing){
            uint232 harvestable = uint232(s.f.harvestable);
            require(listing.price > 0, "Marketplace: Plot not listed.");
            require(harvestable <= listing.expiry, "Marketplace: Listing has expired");
            require(listingAmount <= amount, "Marketplace: Not enough pods in listing");
        }
        
        if (amount >= listingAmount){
            amount = listingAmount;
            delete s.listedPlots[index];
        }
        else{
            s.listedPlots[index.add(amount)] = listing;
            s.listedPlots[index.add(amount)].amount = listingAmount - amount;
            delete s.listedPlots[index];
        }
        emit ListingFilled(buyer, seller, index, listing.price, amount);

    }

    function _transferPlot(address sender, address recipient, uint256 index, uint232 amount) private {
        require(msg.sender != address(0), "Marketplace: Transfer from 0 address.");
        require(recipient != address(0), "Marketplace: Transfer to 0 address.");
 
        insertPlot(msg.sender,index,amount);
        removePlot(recipient,index,0,amount);

        emit PlotTransfer(msg.sender, recipient, index, amount);
    }


    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}
