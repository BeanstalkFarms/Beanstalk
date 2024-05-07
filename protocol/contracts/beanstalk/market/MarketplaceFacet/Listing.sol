/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "./PodTransfer.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/libraries/LibTractor.sol";

/**
 * @author Beanjoyer, Malteasy
 **/

contract Listing is PodTransfer {
    using LibRedundantMath256 for uint256;

    struct PodListing {
        address account;
        uint256 index;
        uint256 start;
        uint256 amount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        uint256 minFillAmount;
        LibTransfer.To mode;
    }

    event PodListingCreated(
        address indexed account,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        LibTransfer.To mode
    );

    event PodListingFilled(
        address indexed from,
        address indexed to,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 costInBeans
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
        uint256 minFillAmount,
        LibTransfer.To mode
    ) internal {
        uint256 plotSize = s.a[LibTractor._user()].field.plots[index];

        require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(LibTractor._user(), index);

        s.podListings[index] = hashListing(
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            minFillAmount,
            mode
        );

        emit PodListingCreated(
            LibTractor._user(),
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            minFillAmount,
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
            l.minFillAmount,
            l.mode
        );

        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(
            plotSize >= (l.start.add(l.amount)) && l.amount > 0,
            "Marketplace: Invalid Plot/Amount."
        );
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = getAmountPodsFromFillListing(l.pricePerPod, l.amount, beanAmount);

        __fillListing(LibTractor._user(), l, amount, beanAmount);
        _transferPlot(l.account, LibTractor._user(), l.index, l.start, amount);
    }

    function __fillListing(
        address to,
        PodListing calldata l,
        uint256 amount,
        uint256 beanAmount
    ) private {
        require(amount >= l.minFillAmount, "Marketplace: Fill must be >= minimum amount.");
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        delete s.podListings[l.index];

        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.minFillAmount,
                l.mode
            );
        }

        emit PodListingFilled(l.account, to, l.index, l.start, amount, beanAmount);
    }

    /*
     * Cancel
     */

    function _cancelPodListing(address account, uint256 index) internal {
        require(s.a[account].field.plots[index] > 0, "Marketplace: Listing not owned by sender.");

        delete s.podListings[index];

        emit PodListingCancelled(account, index);
    }

    /*
     * Helpers
     */

    function getAmountPodsFromFillListing(
        uint24 pricePerPod,
        uint256 podListingAmount,
        uint256 fillBeanAmount
    ) internal pure returns (uint256 amount) {
        amount = (fillBeanAmount * 1000000) / pricePerPod;

        if (amount > podListingAmount) {
            revert("Marketplace: Not enough pods in Listing.");
        }
        uint256 remainingAmount = podListingAmount.sub(amount);
        if (remainingAmount <= (1000000 / pricePerPod)) amount = podListingAmount;
    }

    function hashListing(
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        LibTransfer.To mode
    ) internal pure returns (bytes32 lHash) {
        if (minFillAmount > 0)
            lHash = keccak256(
                abi.encodePacked(
                    start,
                    amount,
                    pricePerPod,
                    maxHarvestableIndex,
                    minFillAmount,
                    mode == LibTransfer.To.EXTERNAL
                )
            );
        else
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
