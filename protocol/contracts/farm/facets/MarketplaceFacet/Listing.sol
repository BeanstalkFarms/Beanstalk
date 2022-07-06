/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./PodTransfer.sol";
import "../../../libraries/Token/LibTransfer.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/
contract Listing is PodTransfer {
    using SafeMath for uint256;

    struct PodListing {
        address account;
        uint256 index;
        uint256 start;
        uint256 amount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        LibTransfer.To mode;
    }

    event PodListingCreated(
        address indexed account,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode
    );
    event PodListingFilled(
        address indexed from,
        address indexed to,
        uint256 index,
        uint256 start,
        uint256 amount
    );
    event PodListingCancelled(address indexed account, uint256 index);

    /*
     * Create
     */

    function _createPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(
            plotSize >= start.add(amount) && amount > 0,
            "Marketplace: Invalid Plot/Amount."
        );
        require(
            0 < pricePerPod,
            "Marketplace: Pod price must be greater than 0."
        );
        require(
            s.f.harvestable <= maxHarvestableIndex,
            "Marketplace: Expired."
        );

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(index);

        s.podListings[index] = hashListing(
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode
        );

        emit PodListingCreated(
            msg.sender,
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            mode
        );
    }

    /*
     * Fill
     */

    function _fillListing(PodListing calldata l, uint256 beanAmount) internal {
        bytes32 lHash = hashListing(
            l.start,
            l.amount,
            l.pricePerPod,
            l.maxHarvestableIndex,
            l.mode
        );
        require(
            s.podListings[l.index] == lHash,
            "Marketplace: Listing does not exist."
        );
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(
            plotSize >= (l.start + l.amount) && l.amount > 0,
            "Marketplace: Invalid Plot/Amount."
        );
        require(
            s.f.harvestable <= l.maxHarvestableIndex,
            "Marketplace: Listing has expired."
        );

        uint256 amount = beanAmount.mul(1000000).div(l.pricePerPod);
        amount = roundAmount(l, amount);

        __fillListing(msg.sender, l, amount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);
    }

    function __fillListing(
        address to,
        PodListing calldata l,
        uint256 amount
    ) private {
        // Note: If l.amount < amount, the function roundAmount will revert

        if (l.amount > amount)
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.mode
            );
        emit PodListingFilled(l.account, to, l.index, l.start, amount);
        delete s.podListings[l.index];
    }

    /*
     * Cancel
     */

    function _cancelPodListing(uint256 index) internal {
        require(
            s.a[msg.sender].field.plots[index] > 0,
            "Marketplace: Listing not owned by sender."
        );
        delete s.podListings[index];
        emit PodListingCancelled(msg.sender, index);
    }

    /*
     * Helpers
     */

    // If remainder left (always <1 pod) that would otherwise be unpurchaseable
    // due to rounding from calculating amount, give it to last buyer
    function roundAmount(PodListing calldata l, uint256 amount)
        private
        pure
        returns (uint256)
    {
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing");
        if (remainingAmount < (1000000 / l.pricePerPod)) amount = l.amount;
        return amount;
    }

    /*
     * Helpers
     */

    function hashListing(
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(
                start,
                amount,
                pricePerPod,
                maxHarvestableIndex,
                mode == LibTransfer.To.EXTERNAL
            )
        );
    }
}
