/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Marketplace.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
**/

contract MarketplaceFacet is Marketplace {

    using SafeMath for uint256;

    /*
     * Listing
     */

    function listPlot(uint256 index, uint24 pricePerPod, uint232 expiry, uint256 amount) public {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= amount && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(0 < pricePerPod && pricePerPod < 1000000, "Marketplace: Invalid Pod Price.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(harvestable <= expiry && expiry <= index, "Marketplace: Invalid Expiry.");
        if (s.listedPlots[index].price > 0){
            cancelListing(index);
        }

        // Optimization: if Listing is full amount of plot, set amount to 0
        // Later, we consider a valid Listing (price>0) with amount 0 to be full amount of plot
        if (amount == plotSize) {
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

    function cancelListing(uint256 index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Listing not owned by user.");
        delete s.listedPlots[index];
        emit ListingCancelled(msg.sender, index);
    }

    function buyListing(uint256 index, address from, uint256 amountBeans) public {
        bean().transferFrom(msg.sender, from, amountBeans);
        _buyListing(index, from, amountBeans);
    }

    function claimAndBuyListing(uint index, address from, uint256 amountBeans, LibClaim.Claim calldata claim) public  {
        allocateBeans(claim, amountBeans, from);
        _buyListing(index, from, amountBeans);
    }


    function buyBeansAndBuyListing(uint256 index, address from, uint256 amountBeans, uint256 buyBeanAmount) public payable {
        if (amountBeans > 0) bean().transferFrom(msg.sender, from, amountBeans);
        _buyBeansAndListing(index,from,amountBeans, buyBeanAmount);
    }

    function claimAndBuyBeansAndBuyListing(uint index, address from, uint256 amountBeans, uint256 buyBeanAmount, LibClaim.Claim calldata claim) public payable  {
        allocateBeans(claim, amountBeans, from);
        _buyBeansAndListing(index,from, amountBeans, buyBeanAmount);
    }

    function _buyBeansAndListing(uint256 index, address from, uint256 amountBeans, uint256 buyBeanAmount) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, from);
        _buyListing(index, from, amountBeans+buyBeanAmount);
    }

    function _buyListing(uint256 index, address from, uint256 amountBeans) internal {
        require(s.listedPlots[index].price > 0, "Marketplace: Listing does not exist.");
        require(msg.sender != from);
        uint256 amount = (amountBeans * 1000000) / s.listedPlots[index].price;
        __buyListing(index,from,amount);
    }

    /*
     * Buy Offers
    **/

    function listBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) public {
        bean().transferFrom(msg.sender, address(this), amountBeans);
        _listBuyOffer(maxPlaceInLine, pricePerPod, amountBeans);
    }

    function claimAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, LibClaim.Claim calldata claim) public  {
        allocateBeans(claim, amountBeans, address(this));
        _listBuyOffer(maxPlaceInLine, pricePerPod, amountBeans);
    }

    function buyBeansAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) public payable {
        if (amountBeans > 0) bean().transferFrom(msg.sender, address(this), amountBeans);
        _buyBeansAndListBuyOffer(maxPlaceInLine, pricePerPod, amountBeans, buyBeanAmount);
    }

    function claimAndBuyBeansAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount, LibClaim.Claim calldata claim) public payable {
        allocateBeans(claim, amountBeans, address(this));
        _buyBeansAndListBuyOffer(maxPlaceInLine, pricePerPod, amountBeans, buyBeanAmount);
    }

    function _buyBeansAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount, address(this));
        _listBuyOffer(maxPlaceInLine,pricePerPod,amountBeans+boughtBeanAmount);
    }

    function _listBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) internal {
        require(0 < pricePerPod && pricePerPod < 1000000, "Marketplace: Invalid Pod Price");
        uint256 amount = (amountBeans * 1000000) / pricePerPod;
        __listBuyOffer(maxPlaceInLine,pricePerPod,amount);
    }

    function buyOffer(uint24 index) public view returns (Storage.BuyOffer memory) {
       return s.buyOffers[index];
    }

    function sellToBuyOffer(uint256 plotIndex, uint256 sellFromIndex, uint24 buyOfferIndex, uint232 amount) public  {
        Storage.BuyOffer storage bOffer = s.buyOffers[buyOfferIndex];
        uint24 price = bOffer.price;
        address owner = bOffer.owner;
        require(price > 0, "Marketplace: Buy Offer does not exist.");
        require(msg.sender !=  owner);
        require(s.a[msg.sender].field.plots[plotIndex] >= (sellFromIndex.sub(plotIndex) + amount), "Marketplace: Invaid Plot.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(sellFromIndex >= harvestable, "Marketplace: Cannot send harvestable plot.");
        uint256 placeInLineEndPlot = sellFromIndex + amount - harvestable;
        require(placeInLineEndPlot <= bOffer.maxPlaceInLine, "Marketplace: Plot too far in line.");
        uint256 costInBeans = (price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        if (s.listedPlots[plotIndex].price > 0){
            cancelListing(plotIndex);
        }
        bOffer.amount = bOffer.amount.sub(amount);
        _transferPlot(msg.sender, owner, plotIndex, sellFromIndex.sub(plotIndex), amount);
        if (bOffer.amount == 0){
            delete s.buyOffers[buyOfferIndex];
        }
        emit BuyOfferFilled(msg.sender, owner, buyOfferIndex, sellFromIndex, price, amount);
    }

    function cancelBuyOffer(uint24 buyOfferIndex) public  {
        Storage.BuyOffer storage bOffer = s.buyOffers[buyOfferIndex];
        require(bOffer.owner == msg.sender, "Field: Buy Offer not owned by user.");
        uint256 amount = bOffer.amount;
        uint256 price = bOffer.price;
        uint256 costInBeans = (price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        delete s.buyOffers[buyOfferIndex];
        emit BuyOfferCancelled(msg.sender, buyOfferIndex);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, address to) private {
        LibClaim.claim(c);
        LibMarket.allocatedBeansTo(transferBeans, to);
    }
}
