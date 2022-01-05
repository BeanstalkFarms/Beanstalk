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

    // TODO
    // whats the point of indexing by address if were going to need every individual event for the entire marketplace data?
    // does listingfilled need anthing other than index and amount?

    event ListingCreated(address indexed account, uint256 index, uint24 pricePerPod, uint232 expiry, uint256 amount);
    event ListingCancelled(address indexed account, uint256 index);
    event ListingFilled(address indexed from, address indexed to, uint256 index, uint24 pricePerPod, uint256 amount);
    event BuyOfferCreated(uint indexed index, address indexed account, uint256 amount, uint24 pricePerPod, uint232 maxPlaceInLine);
    event BuyOfferCancelled(address indexed account, uint256 index);
    event BuyOfferFilled(address indexed from, address indexed to, uint24 buyOfferIndex, uint256 index, uint24 pricePerPod, uint256 amount);
    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);

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

    function buyListing(uint256 index, address from, uint256 amountBeans) public {
        require(s.listedPlots[index].price > 0, "Marketplace: Listing does not exist.");
        uint256 amount = (amountBeans * 1000000) / s.listedPlots[index].price;
        bean().transferFrom(msg.sender, from, amountBeans);
        _buyListing(index,from,amount);
    }

    function buyBeansAndListing(uint256 index, address from, uint256 amountBeans, uint256 buyBeanAmount) public payable {
        require(s.listedPlots[index].price > 0, "Marketplace: Listing does not exist.");
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount);
        bean().transfer(from, boughtBeanAmount);
        if (amountBeans > 0) bean().transferFrom(msg.sender, from, amountBeans);
        uint256 amount = ((amountBeans + buyBeanAmount) * 1000000) / s.listedPlots[index].price;
        _buyListing(index,from,amount);
    }

    function cancelListing(uint256 index) public {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Plot not owned by user.");
        delete s.listedPlots[index];
        emit ListingCancelled(msg.sender, index);
    }

    function claimAndBuyListing(LibClaim.Claim calldata claim, uint index, address from, uint256 amountBeans, uint256 amountToClaim) public  {
        allocateBeans(claim, amountToClaim);
        buyListing(index,from, amountBeans+amountToClaim);
    }

    function claimBuyBeansAndListing(LibClaim.Claim calldata claim, uint index, address from, uint256 amountBeans, uint256 buyBeanAmount, uint256 amountToClaim) public  {
        allocateBeans(claim, amountToClaim);
        buyBeansAndListing(index,from, amountBeans +amountToClaim, buyBeanAmount);
    }

    function listBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans) public  {
        require(0 < pricePerPod && pricePerPod < 1000000, "Marketplace: Invalid Pod Price");
        bean().transferFrom(msg.sender, address(this), amountBeans);
        uint256 amount = (amountBeans * 1000000) / pricePerPod;
        _listBuyOffer(maxPlaceInLine,pricePerPod,amount);
    }

    function buyBeansAndListBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amountBeans, uint256 buyBeanAmount) public payable {
        require(0 < pricePerPod && pricePerPod < 1000000, "Marketplace: Invalid Pod Price");
        uint256 boughtBeanAmount = LibMarket.buyExactTokens(buyBeanAmount);
        if (amountBeans > 0) bean().transferFrom(msg.sender, address(this), amountBeans);
        uint256 amount = ((amountBeans + boughtBeanAmount) * 1000000) / pricePerPod;
        _listBuyOffer(maxPlaceInLine,pricePerPod,amount);
    }

    function buyOffer(uint24 index) public view returns (Storage.BuyOffer memory) {
       return s.buyOffers[index];
    }

    function sellToBuyOffer(uint256 plotIndex, uint256 sellFromIndex, uint24 buyOfferIndex, uint232 amount) public  {
        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];
        require(buyOffer.price > 0, "Marketplace: Buy Offer does not exist.");
        require(s.a[msg.sender].field.plots[plotIndex] >= (sellFromIndex.sub(plotIndex) + amount), "Marketplace: Invaid Plot.");
        uint232 harvestable = uint232(s.f.harvestable);
        require(sellFromIndex >= harvestable, "Marketplace: Cannot send harvestable plot.");
        uint256 placeInLine = sellFromIndex + amount - harvestable;
        require(placeInLine <= buyOffer.maxPlaceInLine, "Marketplace: Plot too far in line.");
        uint256 costInBeans = (buyOffer.price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        if (s.listedPlots[plotIndex].price > 0){
            cancelListing(plotIndex);
        }
        buyOffer.amount = buyOffer.amount.sub(amount);
        _transferPlot(msg.sender, buyOffer.owner, plotIndex, sellFromIndex, amount);
        if (buyOffer.amount == 0){
            delete s.buyOffers[buyOfferIndex];
        }
        emit BuyOfferFilled(msg.sender, buyOffer.owner, buyOfferIndex, plotIndex, buyOffer.price, amount);
        emit BuyOfferFilled(msg.sender, buyOffer.owner, buyOfferIndex, sellFromIndex, buyOffer.price, amount);
    }

    function cancelBuyOffer(uint24 buyOfferIndex) public  {
        Storage.BuyOffer storage buyOffer = s.buyOffers[buyOfferIndex];
        require(buyOffer.owner == msg.sender, "Field: Buy Offer not owned by user.");
        uint256 amount = s.buyOffers[s.buyOfferIndex].amount;
        uint256 price = s.buyOffers[s.buyOfferIndex].price;
        uint256 costInBeans = (price * amount) / 1000000;
        bean().transfer(msg.sender, costInBeans);
        delete s.buyOffers[buyOfferIndex];
        emit BuyOfferCancelled(msg.sender, buyOfferIndex);
    }

    function _buyListing(uint256 index, address from, uint256 amount) private {
        _fillListing(from, msg.sender, index, amount, false);
        _transferPlot(from, msg.sender, index, index, amount);
    }

    function _fillListing(address from, address to, uint256 index, uint256 amount, bool isListingOwner) private {
        require(s.a[from].field.plots[index] >= amount, "Marketplace: Plot has insufficient amount.");
        Storage.Listing storage listing = s.listedPlots[index];
        uint256 listingAmount = listing.amount;
        if (listingAmount == 0){
            listingAmount = s.a[from].field.plots[index];
        }
        if (!isListingOwner){
            uint232 harvestable = uint232(s.f.harvestable);
            require(harvestable <= listing.expiry, "Marketplace: Listing has expired");
            require(listingAmount >= amount, "Marketplace: Not enough pods in listing");
        }
        if (amount >= listingAmount){
            amount = listingAmount;
        }
        else{
            s.listedPlots[index.add(amount)] = listing;
            s.listedPlots[index.add(amount)].amount = listingAmount - amount;
        }
        delete s.listedPlots[index];
        emit ListingFilled(from, to, index, listing.price, amount);

    }

    function _transferPlot(address from, address to, uint256 index, uint256 transferFromIndex,uint256 amount) private {
        require(from != address(0), "Marketplace: Transfer from 0 address.");
        require(to != address(0), "Marketplace: Transfer to 0 address.");
        insertPlot(to,transferFromIndex,amount);
        removePlot(from,index,transferFromIndex.sub(index),amount);
        emit PlotTransfer(from, to, index, amount);
    }

    function _listBuyOffer(uint232 maxPlaceInLine, uint24 pricePerPod, uint256 amount) private{
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

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocatedBeans(transferBeans);
    }
}
