/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";


/**
 * @author Beanjoyer
 * @title TODO
**/

contract MarketplaceFacet {

    using SafeMath for uint256;

    AppStorage s;

    event CreateListing(address indexed account, uint256 indexed index, uint24 price, uint232 expiry);
    event PlotTransfer(address indexed buyer, address indexed seller, uint256 indexed index, uint price, uint256 amount);

    function insertPlot(address account, uint256 id, uint256 amount) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(address account, uint256 id, uint256 start, uint256 end) internal {
        uint256 amount = s.a[account].field.plots[id];
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount) s.a[account].field.plots[id.add(end)] = amount.sub(end);
    }
    function list(uint index, uint24 price, uint232 harvestExpiration) public {
    
        require(s.a[msg.sender].field.plots[index] > 0, "Field: Plot not owned by user.");
        require(price > 0);

        uint232 expiry = uint232(s.f.harvestable.add(harvestExpiration));

        s.listings[index].expiry = expiry;
        s.listings[index].price = price;

    
        emit CreateListing(msg.sender, index, price, expiry);
    }

    function listing (uint256 index) public view returns (Storage.Listing memory) {
       return s.listings[index];
    }

    function buyListing(uint index, address payable recipient) public payable {


        Storage.Listing storage listing = s.listings[index];

        uint amount = s.a[recipient].field.plots[index];

        uint232 harvestable = uint232(s.f.harvestable);

        require(msg.sender != address(0), "Field: Transfer from 0 address.");
        require(recipient != address(0), "Field: Transfer to 0 address.");
        require(msg.value >= listing.price, "Field: Value sent too low");
        require(harvestable <= listing.expiry, "Field: Listing has expired");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "WETH: ETH transfer failed");

        insertPlot(msg.sender,index,amount);
        removePlot(recipient,index,0,amount);

        delete s.listings[index];

        emit PlotTransfer(msg.sender, recipient, index, msg.value, amount);
       
    }

    // offer 
    // place in pod line, price, quantity 


    // do i want to list my plot for sale?
    // instantly sell for $.25 

    // 
    // buy plots in beans


}
