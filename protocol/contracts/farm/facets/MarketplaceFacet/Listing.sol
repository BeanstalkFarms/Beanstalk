/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Dynamic.sol";
import "hardhat/console.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/

contract Listing is Dynamic {

    using SafeMath for uint256;

    struct PodListing {
        address account;
        uint256 index;
        uint256 start;
        uint256 amount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        LibTransfer.To mode;
        PPoly32 f;
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

    event DynamicPodListingCreated(
        address indexed account,
        uint256 index, 
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        uint256[32] ranges,
        uint256[128] values,
        uint256[4] bases,
        uint256 signs
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
        
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListingConstant(start, amount, pricePerPod, maxHarvestableIndex, mode, PricingMode.CONSTANT);
        
        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, mode);

    }

    function _createDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PPoly32 calldata f
    ) internal {
        
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        if(f.mode == PricingMode.CONSTANT) require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListing(start, amount, pricePerPod, maxHarvestableIndex, mode, f.mode, f.ranges, f.values, f.bases, f.signs);
        
        PPoly32 memory _f = toMemory(f);

        emit DynamicPodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, mode, _f.ranges, _f.values, _f.bases, _f.signs);
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
            l.mode,
            l.f.mode,
            l.f.ranges,
            l.f.values,
            l.f.bases,
            l.f.signs
        );

        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        // uint256 pricePerPod = getPrice(l);

        uint256 amount = getRoundedAmount(l, beanAmount);
        // amount = roundAmount(l, amount, pricePerPod);

        __fillListing(msg.sender, l, amount);

        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function __fillListing(
        address to,
        PodListing calldata l,
        uint256 amount
    ) private {

        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount)
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.mode,
                l.f.mode,
                l.f.ranges,
                l.f.values,
                l.f.bases,
                l.f.signs
            );
        emit PodListingFilled(l.account, to, l.index, l.start, amount);
        delete s.podListings[l.index];
    
    }

    /*
     * Cancel
     */

    function _cancelPodListing(address account, uint256 index) internal {
        require(
            s.a[account].field.plots[index] > 0,
            "Marketplace: Listing not owned by sender."
        );
        delete s.podListings[index];
        emit PodListingCancelled(account, index);
    }

    /*
    * Pricing
    */

    function getRoundedAmount(PodListing calldata l, uint256 beanAmount) internal view returns (uint256) {
        uint256 pricePerPod;
        uint256 amount;
        uint256 remainingAmount;
        if (l.f.mode == PricingMode.CONSTANT) {

            pricePerPod = l.pricePerPod;
            amount = (beanAmount * 1000000) / pricePerPod;
            remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
            if(remainingAmount < (1000000 / l.pricePerPod)) amount = l.amount;
            return amount;

        } else {

            pricePerPod = evaluatePPoly(
                l.f, 
                l.index + l.start - s.f.harvestable, 
                findIndex(l.f.ranges, l.index + l.start - s.f.harvestable, getNumIntervals(l.f.ranges) - 1)
            );
            amount = (beanAmount * 1000000) / pricePerPod;
            remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
            if(remainingAmount < (1000000 / pricePerPod)) amount = l.amount;
            return amount;

        }
    }

    /*
     * Helpers
     */

    // If remainder left (always <1 pod) that would otherwise be unpurchaseable
    // due to rounding from calculating amount, give it to last buyer
    function roundAmount(PodListing calldata l, uint256 amount, uint256 pricePerPod)
        private
        pure
        returns (uint256)
    {
        if(l.f.mode != PricingMode.CONSTANT) {
            uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing");
            if (remainingAmount < (1000000 / pricePerPod)) amount = l.amount;
            return amount;
        } else {
            uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing");
            if (remainingAmount < (1000000 / l.pricePerPod)) amount = l.amount;
            return amount;
        }
    }

    /*
     * Helpers
     */

    function hashListingConstant(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode,
        PricingMode priceMode
    ) internal pure returns (bytes32 lHash) {
        (uint256[32] memory ranges, uint256[128] memory values, uint256[4] memory bases) = createZeros();
        uint256 signs = 0;
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, priceMode == PricingMode.CONSTANT, ranges, values, bases, signs));
    }

    function hashListing(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode, 
        PricingMode priceMode, 
        uint256[32] calldata ranges,
        uint256[128] calldata values, 
        uint256[4] calldata bases, 
        uint256 signs
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, priceMode == PricingMode.CONSTANT, ranges, values, bases, signs));
    }

}
