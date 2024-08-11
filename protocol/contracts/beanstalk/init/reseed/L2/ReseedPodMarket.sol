/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {C} from "contracts/C.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {Order} from "contracts/beanstalk/market/MarketplaceFacet/Order.sol";
import {Listing} from "contracts/beanstalk/market/MarketplaceFacet/Listing.sol";

/**
 * @author Deadmanwalking
 * @notice ReseedPodMarket re-initializes the Pod Marketplace.
 * @dev
 */
contract ReseedPodMarket {
    AppStorage internal s;

    uint256 constant FIELD_ID = 0;

    // emitted when a plot is migrated.
    event MigratedPodListing(
        address indexed lister,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        LibTransfer.To mode
    );

    event MigratedPodOrder(
        address indexed orderer,
        bytes32 id,
        uint256 beanAmount,
        uint256 fieldId,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    );

    // struct PodOrder {
    //     address orderer;
    //     uint256 fieldId;
    //     uint24 pricePerPod;
    //     uint256 maxPlaceInLine;
    //     uint256 minFillAmount;
    // }

    // struct PodListing {
    //     address lister;
    //     uint256 fieldId;
    //     uint256 index;
    //     uint256 start;
    //     uint256 podAmount;
    //     uint24 pricePerPod;
    //     uint256 maxHarvestableIndex;
    //     uint256 minFillAmount;
    //     LibTransfer.To mode;
    // }

    /**
     * @notice Re-initializes the pod marketplace.
     * @param podlistings the pod listings in the marketplace at the time of migration
     * @dev 
     */
    function init(PodListing[] podListings, PodOrder[] podOrders) external {
        reseedPodListings(podlistings);
        reseedPodOrders(podlistings);
    }

    /**
     * @notice Re-initializes the pod listings in the marketplace.
     * @param podlistings the pod listings in the marketplace at the time of migration.
     */
    function reseedPodListings(PodListing[] podListings) internal {
        for (uint i; i < podListings.length; i++) {
            // initialize the pod listing
            _createPodListing(podListings[i]);
            emit MigratedPodListing(
                podListings[i].lister,
                podListings[i].fieldId,
                podListings[i].index,
                podListings[i].start,
                podListings[i].podAmount,
                podListings[i].pricePerPod,
                podListings[i].maxHarvestableIndex,
                podListings[i].minFillAmount,
                podListings[i].mode
            );
        }
    }

    /**
     * @notice Re-initializes the pod orders in the marketplace.
     * @param podOrders the pod orders in the marketplace at the time of migration.
     */
    function reseedPodOrders(PodOrder[] podOrders, uint256[] beanAmounts) internal {
        for (uint i; i < podOrders.length; i++) {
            // initialize the pod order
            _createPodOrder(podOrders[i], beanAmounts[i]);
            emit MigratedPodOrder(
                podOrders[i].orderer,
                podOrders[i].id,
                podOrders[i].beanAmount,
                podOrders[i].fieldId,
                podOrders[i].pricePerPod,
                podOrders[i].maxPlaceInLine,
                podOrders[i].minFillAmount
            );
        }
    }
}
