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
        PiecewiseFunction f;
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
        uint256 index, //might not need
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        uint256[numPieces*valueIndexMultiplier] values,
        uint8[numPieces*indexMultiplier] bases,
        bool[numPieces*indexMultiplier] signs
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
        
        (uint256[numValues] memory values, uint8[numMeta] memory bases, bool[numMeta] memory signs) = createZeros();

        //for a regular pod listing, PiecewiseFunction should just be filled with 0s
        s.podListings[index] = hashListingMem(start, amount, pricePerPod, maxHarvestableIndex, mode, PricingMode.CONSTANT, values, bases, signs);
        
        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, mode);

    }

    function _createDPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewiseFunction calldata f
    ) internal {
        
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        if(f.mode == PricingMode.CONSTANT) require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);
        
        s.podListings[index] = hashListing(start, amount, pricePerPod, maxHarvestableIndex, mode, f.mode, f.values, f.bases, f.signs);
        
        uint256[numValues] memory values;
        uint8[numMeta] memory bases;
        bool[numMeta] memory signs;

        for(uint256 i = 0; i < numValues; i++){
            values[i] = f.values[i];
            if(i < numMeta) bases[i] = f.bases[i];
            if(i < numMeta) signs[i] = f.signs[i];
        }
        
        emit DynamicPodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, mode, values, bases, signs);
    
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
            l.f.values,
            l.f.bases,
            l.f.signs
        );
        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 pricePerPod = l.f.mode == PricingMode.CONSTANT ? l.pricePerPod : getListingPrice(l);
        require(pricePerPod <= 1000000, "Marketplace: Invalid price calculated");
        uint256 amount = (beanAmount * 1000000) / pricePerPod;
        amount = roundAmount(l, amount, pricePerPod);

        __fillListing(msg.sender, l, amount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);
    }

    function __fillListing(
        address to,
        PodListing calldata l,
        uint256 amount
    ) private {
        // console.log(l.amount, amount);
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount)
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.mode,
                l.f.mode,
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

    function getListingPrice(PodListing calldata l) internal view returns (uint256) {
        uint256[] memory subintervals = parseIntervals(l.f.values);
        uint256 index = findIndex(subintervals, l.index + l.start - s.f.harvestable);
        index = index > 0 ? index - 1 : 0;
        uint256 intervalDeg = getFunctionDegree(l.f, index);
        uint256 pricePerPod = evaluatePiecewiseFunction(l.f, l.index + l.start - s.f.harvestable, index, intervalDeg);
        return pricePerPod;
    
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

     function hashListingMem(uint256 start, uint256 amount, uint24 pricePerPod, uint256 maxHarvestableIndex, LibTransfer.To mode, PricingMode priceMode, uint256[numValues] memory values, uint8[numMeta] memory bases, bool[numMeta] memory signs) 
        internal 
        pure 
        returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, priceMode == PricingMode.CONSTANT, values, bases, signs));
    }

    function hashListing(uint256 start, uint256 amount, uint24 pricePerPod, uint256 maxHarvestableIndex, LibTransfer.To mode, PricingMode priceMode, uint256[numValues] calldata values, uint8[numMeta] calldata bases, bool[numMeta] calldata signs) 
        internal 
        pure 
        returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, priceMode == PricingMode.CONSTANT, values, bases, signs));
    }
}
