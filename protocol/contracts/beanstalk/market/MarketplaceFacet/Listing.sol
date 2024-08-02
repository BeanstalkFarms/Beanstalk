/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./PodTransfer.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/libraries/LibPolynomial.sol";

/**
 * @author Beanjoyer, Malteasy
 * @title Pod Marketplace v2
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
        bytes pricingFunction,
        LibTransfer.To mode,
        LibPolynomial.PriceType pricingType
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
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        
        require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListing(start, amount, pricePerPod, maxHarvestableIndex, minFillAmount, mode);

        bytes memory f;
        
        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, minFillAmount, f, mode, LibPolynomial.PriceType.Fixed);

    }

    function _createPodListingV2(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];

        require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListingV2(
            start, 
            amount, 
            0, 
            maxHarvestableIndex, 
            minFillAmount,
            pricingFunction,
            mode
        );
        
        emit PodListingCreated(
            msg.sender, 
            index, 
            start, 
            amount, 
            0, 
            maxHarvestableIndex, 
            minFillAmount,
            pricingFunction,
            mode,
            LibPolynomial.PriceType.Dynamic
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
        require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = getAmountPodsFromFillListing(l.pricePerPod, l.amount, beanAmount);

        __fillListing(msg.sender, l, amount, beanAmount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function _fillListingV2(
        PodListing calldata l, 
        uint256 beanAmount,
        bytes calldata pricingFunction
    ) internal {
        bytes32 lHash = hashListingV2(
            l.start,
            l.amount,
            l.pricePerPod,
            l.maxHarvestableIndex,
            l.minFillAmount,
            pricingFunction,
            l.mode
        );
        
        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");

        uint256 plotSize = s.a[l.account].field.plots[l.index];

        require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = getAmountPodsFromFillListingV2(l.index.add(l.start).sub(s.f.harvestable), l.amount, beanAmount, pricingFunction);

        __fillListingV2(msg.sender, l, pricingFunction, amount, beanAmount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

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

    function __fillListingV2(
        address to,
        PodListing calldata l,
        bytes calldata pricingFunction,
        uint256 amount,
        uint256 beanAmount
    ) private {
        require(amount >= l.minFillAmount, "Marketplace: Fill must be >= minimum amount.");
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        delete s.podListings[l.index];

        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashListingV2(
                0,
                l.amount.sub(amount),
                l.pricePerPod,
                l.maxHarvestableIndex,
                l.minFillAmount,
                pricingFunction,
                l.mode
            );
        }

        emit PodListingFilled(l.account, to, l.index, l.start, amount, beanAmount);
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

    function getAmountPodsFromFillListing(uint24 pricePerPod, uint256 podListingAmount, uint256 fillBeanAmount) internal pure returns (uint256 amount) {
        amount = (fillBeanAmount * 1000000) / pricePerPod;
        
        uint256 remainingAmount = podListingAmount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = podListingAmount;
    }

    function getAmountPodsFromFillListingV2(
        uint256 placeInLine, 
        uint256 podListingAmount,
        uint256 fillBeanAmount,
        bytes calldata pricingFunction
    ) public pure returns (uint256 amount) {
        uint256 pricePerPod = LibPolynomial.evaluatePolynomialPiecewise(pricingFunction, placeInLine);
        amount = (fillBeanAmount.mul(1000000)) / pricePerPod;
        
        uint256 remainingAmount = podListingAmount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = podListingAmount;
    }

    function hashListing(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        uint256 minFillAmount,
        LibTransfer.To mode
    ) internal pure returns (bytes32 lHash) {
        if(minFillAmount > 0) lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  minFillAmount, mode == LibTransfer.To.EXTERNAL));
        else lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL));
    }

    function hashListingV2(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        uint256 minFillAmount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal pure returns (bytes32 lHash) {
        require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex, minFillAmount, mode == LibTransfer.To.EXTERNAL, pricingFunction));
    }

}
