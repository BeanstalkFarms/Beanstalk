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
        uint256 fieldIndex;
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
        uint256 fieldIndex,
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
        uint256 fieldIndex,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint256 costInBeans
    );

    event PodListingCancelled(address indexed lister, uint256 fieldIndex, uint256 index);

    /*
     * Create
     */

    function _createPodListing(PodListing calldata podListing) internal {
        uint256 plotSize = s.accountStates[podListing.lister].fields[podListing.fieldIndex].plots[
            podListing.index
        ];

        require(
            plotSize >= (podListing.start + podListing.podAmount) && podListing.podAmount > 0,
            "Marketplace: Invalid Plot/Amount."
        );
        require(podListing.pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(
            s.fields[podListing.fieldIndex].harvestable <= podListing.maxHarvestableIndex,
            "Marketplace: Expired."
        );

        bytes32 id = _getListingId(podListing.fieldIndex, podListing.index);
        if (s.podListings[id] == true)
            _cancelPodListing(podListing.lister, podListing.fieldIndex, podListing.index);

        s.podListings[id] = true;

        emit PodListingCreated(
            podListing.lister,
            podListing.fieldIndex,
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
        bytes32 id = _getListingId(podListing.fieldIndex, podListing.index);
        require(s.podListings[id] == true, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.accountStates[podListing.lister].fields[podListing.fieldIndex].plots[
            podListing.index
        ];
        require(
            plotSize >= (podListing.start + podListing.podAmount) && podListing.podAmount > 0,
            "Marketplace: Invalid Plot/Amount."
        );
        require(
            s.fields[podListing.fieldIndex].harvestable <= podListing.maxHarvestableIndex,
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
        require(
            podReceiveAmount <= podListing.podAmount,
            "Marketplace: Not enough pods in Listing."
        );

        delete s.podListings[id];

        if (podListing.podAmount > podReceiveAmount) {
            s.podListings[
                _getListingId(
                    podListing.fieldIndex,
                    podListing.index + podReceiveAmount + podListing.start
                )
            ] = true;
        }

        emit PodListingFilled(
            filler,
            podListing.lister,
            podListing.fieldIndex,
            podListing.index,
            podListing.start,
            podReceiveAmount,
            beanPayAmount
        );

        _transferPlot(
            podListing.lister,
            filler,
            podListing.fieldIndex,
            podListing.index,
            podListing.start,
            podReceiveAmount
        );
    }

    /*
     * Cancel
     */

    function _cancelPodListing(address account, uint256 fieldIndex, uint256 index) internal {
        require(
            s.accountStates[account].fields[fieldIndex].plots[index] > 0,
            "Marketplace: Listing not owned by sender."
        );

        delete s.podListings[_getListingId(fieldIndex, index)];

        emit PodListingCancelled(account, fieldIndex, index);
    }

    /*
     * Get
     */

    function _getListingId(uint256 fieldIndex, uint256 index) internal pure returns (bytes32 id) {
        return keccak256(abi.encodePacked(fieldIndex, index));
    }
}
