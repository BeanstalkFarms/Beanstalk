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

   
  
    struct Listing {
        address account; //20
        uint256 index; //32
        uint256 start; //32
        uint256 amount; //32
        uint24 pricePerPod; //3 -> starting price
        uint256 maxHarvestableIndex; // expiry
        bool toWallet;
        bool constantPricing;
        MathFP.PiecewiseFormula f;
    }

    event PodListingCreated(
        address indexed account, 
        uint256 index, 
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        bool toWallet,
        bool constantPricing,
        uint256[10] subIntervalIndex,
        uint240[10] constantsDegreeZero,
        uint8[10] shiftsDegreeZero,
        bool[10] boolsDegreeZero,
        uint240[10] constantsDegreeOne,
        uint8[10] shiftsDegreeOne,
        bool[10] boolsDegreeOne,
        uint240[10] constantsDegreeTwo,
        uint8[10] shiftsDegreeTwo,
        bool[10] boolsDegreeTwo,
        uint240[10] constantsDegreeThree,
        uint8[10] shiftsDegreeThree,
        bool[10] boolsDegreeThree
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
        bool toWallet,
        bool constantPricing,
        MathFP.PiecewiseFormula calldata f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");

        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(index);

        s.podListings[index] = hashListing(
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            toWallet, 
            constantPricing, 
            f.subIntervalIndex,
            f.constantsDegreeZero,
            f.shiftsDegreeZero,
            f.boolsDegreeZero,
            f.constantsDegreeOne,
            f.shiftsDegreeOne,
            f.boolsDegreeOne,
            f.constantsDegreeTwo,
            f.shiftsDegreeTwo,
            f.boolsDegreeTwo,
            f.constantsDegreeThree,
            f.shiftsDegreeThree,
            f.boolsDegreeThree
        );

        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, toWallet, constantPricing, f.subIntervalIndex,
            f.constantsDegreeZero,
            f.shiftsDegreeZero,
            f.boolsDegreeZero,
            f.constantsDegreeOne,
            f.shiftsDegreeOne,
            f.boolsDegreeOne,
            f.constantsDegreeTwo,
            f.shiftsDegreeTwo,
            f.boolsDegreeTwo,
            f.constantsDegreeThree,
            f.shiftsDegreeThree,
            f.boolsDegreeThree);
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
        _fillListing(l, beanAmount+boughtBeanAmount);
    }

    function _fillListing(
        Listing calldata l,
        uint256 beanAmount
    ) internal {
        bytes32 lHash = hashListing(
            l.start, 
            l.amount, 
            l.pricePerPod, 
            l.maxHarvestableIndex, 
            l.toWallet, 
            l.constantPricing, 
            l.f.subIntervalIndex, 
            l.f.constantsDegreeZero,
            l.f.shiftsDegreeZero,
            l.f.boolsDegreeZero,
            l.f.constantsDegreeOne,
            l.f.shiftsDegreeOne,
            l.f.boolsDegreeOne,
            l.f.constantsDegreeTwo,
            l.f.shiftsDegreeTwo,
            l.f.boolsDegreeTwo,
            l.f.constantsDegreeThree,
            l.f.shiftsDegreeThree,
            l.f.boolsDegreeThree
        );
        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");
        // calculate price per pod here
        // uint256 amount = (beanAmount * 1000000) / l.pricePerPod;
        uint256 pricePerPod;
        uint256 amount;
        uint256 placeInLine = l.index + l.start + l.amount - s.f.harvestable;

        if (l.constantPricing) {
            pricePerPod = l.pricePerPod;
        }
        else {
            pricePerPod = MathFP.evaluatePCubicP(l.f, placeInLine);
        }

        amount = (beanAmount * 1000000) / pricePerPod;

        amount = roundAmount(l.amount, beanAmount, pricePerPod);

        __fillListing(l.account, msg.sender, l, amount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);
    }

    function __fillListing(
        address from,
        address to,
        Listing calldata l,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        if (l.amount > amount) s.podListings[l.index.add(amount).add(l.start)] = hashListing(
                                    0, 
                                    l.amount.sub(amount), 
                                    l.pricePerPod, 
                                    l.maxHarvestableIndex, 
                                    l.toWallet, 
                                    l.fType, 
                                    [l.f.a, l.f.b, l.f.c, l.f.d], 
                                    [l.f.aShift, l.f.bShift, l.f.cShift, l.f.dShift],
                                    [l.f.aSign, l.f.bSign, l.f.cSign, l.f.dSign]
                                );
        emit PodListingFilled(l.account, to, l.index, l.start, amount);
        delete s.podListings[l.index];
    }

    /*
     * Cancel
     */

    function _cancelPodListing(uint256 index) internal {
        require(s.a[msg.sender].field.plots[index] > 0, "Marketplace: Listing not owned by sender.");
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
    )  pure private returns (uint256) {
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
        bool toWallet, 
        bool constantPricing,
        uint256[10] subIntervalIndex,
        uint240[10] constantsDegreeZero,
        uint8[10] shiftsDegreeZero,
        bool[10] boolsDegreeZero,
        uint240[10] constantsDegreeOne,
        uint8[10] shiftsDegreeOne,
        bool[10] boolsDegreeOne,
        uint240[10] constantsDegreeTwo,
        uint8[10] shiftsDegreeTwo,
        bool[10] boolsDegreeTwo,
        uint240[10] constantsDegreeThree,
        uint8[10] shiftsDegreeThree,
        bool[10] boolsDegreeThree
    ) pure internal returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex, toWallet, constantPricing, subIntervalIndex, constantsDegreeZero, shiftsDegreeZero, boolsDegreeZero, constantsDegreeOne, shiftsDegreeOne, boolsDegreeOne, constantsDegreeTwo,
            shiftsDegreeTwo, boolsDegreeTwo, constantsDegreeThree, shiftsDegreeThree, boolsDegreeThree)
        );
    }
}