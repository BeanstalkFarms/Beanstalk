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

    struct PodListingData {
        bytes32 id;
        address lister;
        uint256 index;
        uint256 start;
        uint256 podAmount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        uint256 minFillAmount;
        LibTransfer.To mode;
    }

    struct PodOrderData {
        address orderer;
        bytes32 id;
        uint256 beanAmount;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        uint256 minFillAmount;
    }

    // mapping(uint256 => mapping(uint256 => bytes32)) podListings;
    // mapping(bytes32 => uint256) podOrders;

    /**
     * @notice Re-initializes the pod marketplace.
     * @param podListings the pod listings in the marketplace at the time of migration
     * @dev
     */
    function init(
        PodListingData[] calldata podListings,
        PodOrderData[] calldata podOrders
    ) external {
        reseedPodListings(podListings);
        reseedPodOrders(podOrders);
    }

    /**
     * @notice Re-initializes the pod listings in the marketplace.
     * @param podListings the pod listings in the marketplace at the time of migration.
     */
    function reseedPodListings(PodListingData[] calldata podListings) internal {
        for (uint i; i < podListings.length; i++) {
            // set listing index to hash
            s.sys.podListings[FIELD_ID][podListings[i].index] = podListings[i].id;
            emit MigratedPodListing(
                podListings[i].lister,
                FIELD_ID,
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
    function reseedPodOrders(PodOrderData[] calldata podOrders) internal {
        for (uint i; i < podOrders.length; i++) {
            // set order hash to bean amount
            s.sys.podOrders[podOrders[i].id] = podOrders[i].beanAmount;
            s.sys.orderLockedBeans += podOrders[i].beanAmount;
            emit MigratedPodOrder(
                podOrders[i].orderer,
                podOrders[i].id,
                podOrders[i].beanAmount,
                FIELD_ID,
                podOrders[i].pricePerPod,
                podOrders[i].maxPlaceInLine,
                podOrders[i].minFillAmount
            );
        }
    }
}
