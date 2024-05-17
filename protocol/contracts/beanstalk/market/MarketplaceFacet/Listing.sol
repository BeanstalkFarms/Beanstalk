/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {PodTransfer} from "./PodTransfer.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";

/**
 * @author Beanjoyer, Malteasy, funderbrker
 **/

contract Listing is PodTransfer {
    struct PodListing {
        address lister;
        uint256 fieldId;
        uint256 index;
        uint256 start;
        uint256 podAmount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        uint256 minFillAmount;
        LibTransfer.To mode;
    }

    event PodListingCreated(
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

    event PodListingFilled(
        address indexed filler,
        address indexed lister,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint256 costInBeans
    );

    event PodListingCancelled(address indexed lister, uint256 fieldId, uint256 index);

    /*
     * Create
     */

    function _createPodListing(PodListing calldata podListing) internal {
        uint256 plotSize = s.accounts[podListing.lister].fields[podListing.fieldId].plots[
            podListing.index
        ];

        require(podListing.podAmount > 0, "Marketplace: Invalid Amount.");
        require(
            plotSize >= (podListing.start + podListing.podAmount),
            "Marketplace: Invalid Plot."
        );
        require(podListing.pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(
            s.fields[podListing.fieldId].harvestable <= podListing.maxHarvestableIndex,
            "Marketplace: Expired."
        );

        if (s.podListings[podListing.fieldId][podListing.index] != bytes32(0))
            _cancelPodListing(podListing.lister, podListing.fieldId, podListing.index);

        s.podListings[podListing.fieldId][podListing.index] = _hashListing(podListing);

        emit PodListingCreated(
            podListing.lister,
            podListing.fieldId,
            podListing.index,
            podListing.start,
            podListing.podAmount,
            podListing.pricePerPod,
            podListing.maxHarvestableIndex,
            podListing.minFillAmount,
            podListing.mode
        );
    }

    /*
     * Fill
     */

    function _fillListing(
        PodListing calldata podListing,
        address filler,
        uint256 beanPayAmount
    ) internal {
        require(
            s.podListings[podListing.fieldId][podListing.index] == _hashListing(podListing),
            "Marketplace: Listing does not exist."
        );
        uint256 plotSize = s.accounts[podListing.lister].fields[podListing.fieldId].plots[
            podListing.index
        ];
        require(podListing.podAmount > 0, "Marketplace: Invalid Amount.");
        require(
            plotSize >= (podListing.start + podListing.podAmount),
            "Marketplace: Invalid Plot."
        );
        require(
            s.fields[podListing.fieldId].harvestable <= podListing.maxHarvestableIndex,
            "Marketplace: Listing has expired."
        );

        uint256 podReceiveAmount = (beanPayAmount * 1000000) / podListing.pricePerPod;
        require(
            podReceiveAmount <= podListing.podAmount,
            "Marketplace: Not enough pods in Listing."
        );

        // Round.
        if (podListing.podAmount - podReceiveAmount <= (1000000 / podListing.pricePerPod)) {
            podReceiveAmount = podListing.podAmount;
        }

        require(
            podReceiveAmount >= podListing.minFillAmount,
            "Marketplace: Fill must be >= minimum amount."
        );

        // Remove old listing and create new listing if necessary.
        delete s.podListings[podListing.fieldId][podListing.index];

        if (podReceiveAmount < podListing.podAmount) {
            uint256 newIndex = podListing.index + podReceiveAmount + podListing.start;
            s.podListings[podListing.fieldId][newIndex] = _hashListing(
                PodListing(
                    podListing.lister,
                    podListing.fieldId,
                    newIndex,
                    0,
                    podListing.podAmount - podReceiveAmount,
                    podListing.pricePerPod,
                    podListing.maxHarvestableIndex,
                    podListing.minFillAmount,
                    podListing.mode
                )
            );
        }

        emit PodListingFilled(
            filler,
            podListing.lister,
            podListing.fieldId,
            podListing.index,
            podListing.start,
            podReceiveAmount,
            beanPayAmount
        );

        _transferPlot(
            podListing.lister,
            filler,
            podListing.fieldId,
            podListing.index,
            podListing.start,
            podReceiveAmount
        );
    }

    /*
     * Cancel
     */

    function _cancelPodListing(address lister, uint256 fieldId, uint256 index) internal {
        require(
            s.accounts[lister].fields[fieldId].plots[index] > 0,
            "Marketplace: Listing not owned by sender."
        );

        delete s.podListings[fieldId][index];

        emit PodListingCancelled(lister, fieldId, index);
    }

    /*
     * Get
     */

    function _hashListing(PodListing memory podListing) internal pure returns (bytes32 hash) {
        return
            keccak256(
                abi.encodePacked(
                    podListing.lister,
                    podListing.fieldId,
                    podListing.index,
                    podListing.start,
                    podListing.podAmount,
                    podListing.pricePerPod,
                    podListing.maxHarvestableIndex,
                    podListing.minFillAmount,
                    podListing.mode
                )
            );
    }
}
