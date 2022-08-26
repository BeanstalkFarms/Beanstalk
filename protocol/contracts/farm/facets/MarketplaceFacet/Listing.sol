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
        uint256[16] polynomialBreakpoints,
        uint256[64] polynomialConstants,
        uint256[2] packedPolynomialBases,
        uint256 packedPolynomialSigns
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

        s.podListings[index] = hashListing(start, amount, pricePerPod, maxHarvestableIndex, mode);
        
        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, mode);

    }

    function _createDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial calldata f
    ) internal {

        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashDynamicListing(
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            mode, 
            f.breakpoints, 
            f.significands, 
            f.packedExponents, 
            f.packedSigns
        );

        (uint256[16] memory polynomialBreakpoints, uint256[64] memory polynomialSignificands) = loadArraysToMemory(f.breakpoints, f.significands);
        
        emit DynamicPodListingCreated(
            msg.sender, 
            index, 
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            mode, 
            polynomialBreakpoints, 
            polynomialSignificands, 
            [f.packedExponents[0], f.packedExponents[1]],
            f.packedSigns
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
        
        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = getRoundedAmount(l, beanAmount);

        __fillListing(msg.sender, l, amount);

        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function _fillDynamicListing(PodListing calldata l, PiecewisePolynomial calldata f, uint256 beanAmount) internal {

        bytes32 lHash = hashDynamicListing(
            l.start,
            l.amount,
            l.pricePerPod,
            l.maxHarvestableIndex,
            l.mode,
            f.breakpoints,
            f.significands,
            f.packedExponents,
            f.packedSigns
        );

        
        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = getDynamicRoundedAmount(l, f, beanAmount);

        __fillDynamicListing(msg.sender, l, f, amount);

        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function __fillListing(
        address to,
        PodListing calldata l,
        uint256 amount
    ) private {

        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.mode
            );
        }
        emit PodListingFilled(l.account, to, l.index, l.start, amount);
        delete s.podListings[l.index];
    
    }

    function __fillDynamicListing(
        address to,
        PodListing calldata l,
        PiecewisePolynomial calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashDynamicListing(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.mode,
                f.breakpoints,
                f.significands,
                f.packedExponents,
                f.packedSigns
            );
        }
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
     * Helpers
     */

    // If remainder left (always <1 pod) that would otherwise be unpurchaseable
    // due to rounding from calculating amount, give it to last buyer
    function getRoundedAmount(PodListing calldata l, uint256 beanAmount) internal pure returns (uint256 amount) {
        amount = (beanAmount * 1000000) / l.pricePerPod;
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / l.pricePerPod)) amount = l.amount;
    }

    function getDynamicRoundedAmount(PodListing calldata l, PiecewisePolynomial calldata f, uint256 beanAmount) internal view returns (uint256 amount) {
        uint24 pricePerPod = uint24(evaluatePolynomial(
            f, 
            l.index + l.start - s.f.harvestable, 
            findPieceIndex(f.breakpoints, l.index + l.start - s.f.harvestable, getNumPieces(f.breakpoints) - 1)
        ));
        amount = (beanAmount * 1000000) / pricePerPod;
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = l.amount;
    }

    function hashListing(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL));
    }

    function hashDynamicListing(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode, 
        uint256[16] calldata ranges,
        uint256[64] calldata values, 
        uint256[2] calldata bases, 
        uint256 signs
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, ranges, values, bases, signs));
    }

}
