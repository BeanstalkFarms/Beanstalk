/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibIncentive.sol";
import "./PodTransfer.sol";
import "./FixedPointMath.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/
contract Listing is PodTransfer {
    using SafeMath for uint256;

    struct PiecewiseCubic {
        uint256[10] subIntervalIndex;
        uint256[40] constants;
        uint8[40] shifts;
        bool[40] signs;
    }

    struct Listing {
        address account; 
        uint256 index; 
        uint256 start; 
        uint256 amount; 
        uint24 pricePerPod;
        uint256 maxHarvestableIndex; 
        bool toWallet;
    }

    struct DynamicListing {
        address account;
        uint256 index;
        uint256 start;
        uint256 amount;
        uint256 maxHarvestableIndex;
        bool toWallet;
        PiecewiseCubic f;
    }

    event PodListingCreated(
        address indexed account,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        bool toWallet
    );

    event DynamicPodListingCreated(
        address indexed account,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 maxHarvestableIndex,
        bool toWallet,
        uint256[10] subIntervalIndex,
        uint256[40] constants,
        uint8[40] shifts,
        bool[40] signs
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
        bool toWallet
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(
            plotSize >= (start + amount) && amount > 0,
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
            toWallet
        );

        emit PodListingCreated(
            msg.sender,
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            toWallet
        );
    }

    function _createDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 maxHarvestableIndex,
        bool toWallet,
        PiecewiseCubic calldata f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(
            plotSize >= (start + amount) && amount > 0,
            "Marketplace: Invalid Plot/Amount."
        );

        require(
            s.f.harvestable <= maxHarvestableIndex,
            "Marketplace: Expired."
        );

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(index);

        s.podListings[index] = hashDynamicListing(
            start,
            amount,
            maxHarvestableIndex,
            toWallet,
            f.subIntervalIndex,
            f.constants,
            f.shifts,
            f.signs
        );

        emit DynamicPodListingCreated(
            msg.sender,
            index,
            start,
            amount,
            maxHarvestableIndex,
            toWallet,
            f.subIntervalIndex,
            f.constants,
            f.shifts,
            f.signs
        );
    }

    /*
     * Fill
     */

    function _buyBeansAndFillPodListing(
        Listing calldata l,
        uint256 beanAmount,
        uint256 buyBeanAmount
    ) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokensToWallet(
            buyBeanAmount,
            l.account,
            l.toWallet
        );
        _fillListing(l, beanAmount + boughtBeanAmount);
    }

    function _buyBeansAndFillDynamicPodListing(
        DynamicListing calldata l,
        uint256 beanAmount,
        uint256 buyBeanAmount
    ) internal {
        uint256 boughtBeanAmount = LibMarket.buyExactTokensToWallet(
            buyBeanAmount,
            l.account,
            l.toWallet
        );
        _fillDynamicListing(l, beanAmount + boughtBeanAmount);
    }

    function _fillListing(Listing calldata l, uint256 beanAmount) internal {
        bytes32 lHash = hashListing(
            l.start,
            l.amount,
            l.pricePerPod,
            l.maxHarvestableIndex,
            l.toWallet
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

        uint256 amountBeans = (beanAmount * 1000000) / l.pricePerPod;

        __fillListing(l.account, msg.sender, l, amountBeans);
        _transferPlot(l.account, msg.sender, l.index, l.start, amountBeans);
    }

    function _fillDynamicListing(DynamicListing calldata l, uint256 beanAmount)
        internal
    {
        bytes32 lHash = hashDynamicListing(
            l.start,
            l.amount,
            l.maxHarvestableIndex,
            l.toWallet,
            l.f.subIntervalIndex,
            l.f.constants,
            l.f.shifts,
            l.f.signs
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

        uint256 i = _findIndex(
            l.f.subIntervalIndex,
            l.index + l.start - s.f.harvestable
        );
        uint256 pricePerPod = _getPriceAtIndex(
            l.f,
            l.index + l.start - s.f.harvestable,
            i
        );
        beanAmount = (beanAmount * 1000000) / pricePerPod;
        __fillDynamicListing(l.account, msg.sender, l, beanAmount);
        _transferPlot(l.account, msg.sender, l.index, l.start, beanAmount);
    }

    function _findIndex(uint256[10] calldata subIntervalIndex, uint256 x)
        internal pure 
        returns (uint256)
    {
        return MathFP.findIndexWithinSubinterval(subIntervalIndex, x);
    }

    function _getPriceAtIndex(
        PiecewiseCubic calldata f,
        uint256 x,
        uint256 i
    ) internal pure returns (uint256 amountBeans) {
        amountBeans = MathFP.evaluateCubic(
            [f.signs[i], f.signs[i + 10], f.signs[i + 20], f.signs[i + 30]],
            [f.shifts[i], f.shifts[i + 10], f.shifts[i + 20], f.shifts[i + 30]],
            [
                f.constants[i],
                f.constants[i + 10],
                f.constants[i + 20],
                f.constants[i + 30]
            ],
            x,
            false
        );
    }

    function __fillListing(
        address from,
        address to,
        Listing calldata l,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        if (l.amount > amount)
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.toWallet
            );
        emit PodListingFilled(l.account, to, l.index, l.start, amount);
        delete s.podListings[l.index];
    }

    function __fillDynamicListing(
        address from,
        address to,
        DynamicListing calldata l,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        if (l.amount > amount)
            s.podListings[
                l.index.add(amount).add(l.start)
            ] = hashDynamicListing(
                0,
                l.amount.sub(amount),
                l.maxHarvestableIndex,
                l.toWallet,
                l.f.subIntervalIndex,
                l.f.constants,
                l.f.shifts,
                l.f.signs
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
    function roundAmount(
        uint256 listingAmount,
        uint256 amount,
        uint24 pricePerPod
    ) private pure returns (uint256) {
        if ((listingAmount - amount) < (1000000 / pricePerPod))
            amount = listingAmount;
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
        bool toWallet
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(
                start,
                amount,
                pricePerPod,
                maxHarvestableIndex,
                toWallet
            )
        );
    }

    function hashDynamicListing(
        uint256 start,
        uint256 amount,
        uint256 maxHarvestableIndex,
        bool toWallet,
        uint256[10] calldata subIntervalIndex,
        uint256[40] calldata constants,
        uint8[40] calldata shifts,
        bool[40] calldata bools
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(
                start,
                amount,
                maxHarvestableIndex,
                toWallet,
                subIntervalIndex,
                constants,
                shifts,
                bools
            )
        );
    }
}
