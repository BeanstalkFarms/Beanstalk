/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";

/**
 * @author TODO
 * @title TODO
**/

contract MarketplaceFacet {

    AppStorage private s;

    using SafeMath for uint256;

    event CreateListing(address indexed account, uint256 indexed index, uint24 price, uint232 expiry);

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

}
