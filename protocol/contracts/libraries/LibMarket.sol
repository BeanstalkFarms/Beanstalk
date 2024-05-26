/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";

/**
 * @title LibMarket
 * @author funderbrker
 * @notice LibMarket handles Market functionality that is needed in multiple Facets.
 */
library LibMarket {
    event PodListingCancelled(address indexed lister, uint256 fieldId, uint256 index);

    function _cancelPodListing(address lister, uint256 fieldId, uint256 index) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(
            s.accts[lister].fields[fieldId].plots[index] > 0,
            "Marketplace: Listing not owned by sender."
        );

        delete s.sys.podListings[fieldId][index];

        emit PodListingCancelled(lister, fieldId, index);
    }
}
