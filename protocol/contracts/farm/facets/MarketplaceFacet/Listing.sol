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
        uint256[9] intervalIntegrations,
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
            toWallet,
            constantPricing,
            f.subIntervalIndex,
            f.intervalIntegrations,
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

        emit PodListingCreated(
            msg.sender,
            index,
            start,
            amount,
            pricePerPod,
            maxHarvestableIndex,
            toWallet,
            constantPricing,
            f.subIntervalIndex,
            f.intervalIntegrations,
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

    function _fillListing(Listing calldata l, uint256 beanAmount) internal {
        bytes32 lHash = hashListing(
            l.start,
            l.amount,
            l.pricePerPod,
            l.maxHarvestableIndex,
            l.toWallet,
            l.constantPricing,
            l.f.subIntervalIndex,
            l.f.intervalIntegrations,
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

        // calculate price per pod here
        // uint256 amount = (beanAmount * 1000000) / l.pricePerPod;
        uint256 amountBeans;

        //for listings, calculate the place in line of the first pod theyre buying
        uint256 placeInLine = l.index + l.start - s.f.harvestable;

        if (l.constantPricing) {
            //if constant pricing for all pods, the amount is calculated by dividing the amount of beans by the price per pod
            amountBeans = (beanAmount * 1000000) / l.pricePerPod;
        } else {
            // if the pricing is piecewise polynomial, the amount is calculated by integrating between placeInLine and the amount of beans
            uint256 startIndex = MathFP.findIndexWithinSubinterval(
                l.f.subIntervalIndex,
                placeInLine
            );
            uint256 endIndex = MathFP.findIndexWithinSubinterval(
                l.f.subIntervalIndex,
                placeInLine + beanAmount
            );

            //compare to start value of next index, in this false case they must be equal
            bool endValue = (placeInLine + beanAmount) <
                l.f.subIntervalIndex[startIndex + 1];
            // compute first index integral only if in same piecewise domain
            if (startIndex == endIndex) {
                amountBeans += MathFP.evaluateDefiniteIntegralCubic(
                    placeInLine,
                    placeInLine + beanAmount,
                    l.f.subIntervalIndex[startIndex],
                    endValue,
                    [
                        l.f.constantsDegreeZero[startIndex],
                        l.f.constantsDegreeOne[startIndex],
                        l.f.constantsDegreeTwo[startIndex],
                        l.f.constantsDegreeThree[startIndex]
                    ],
                    [
                        l.f.shiftsDegreeZero[startIndex],
                        l.f.shiftsDegreeOne[startIndex],
                        l.f.shiftsDegreeTwo[startIndex],
                        l.f.shiftsDegreeThree[startIndex]
                    ],
                    [
                        l.f.boolsDegreeZero[startIndex],
                        l.f.boolsDegreeOne[startIndex],
                        l.f.boolsDegreeTwo[startIndex],
                        l.f.boolsDegreeThree[startIndex]
                    ]
                );
            } else if (endIndex > startIndex) {
                //add the first part
                amountBeans += MathFP.evaluateDefiniteIntegralCubic(
                    placeInLine,
                    l.f.subIntervalIndex[startIndex + 1],
                    l.f.subIntervalIndex[startIndex],
                    false,
                    [
                        l.f.constantsDegreeZero[startIndex],
                        l.f.constantsDegreeOne[startIndex],
                        l.f.constantsDegreeTwo[startIndex],
                        l.f.constantsDegreeThree[startIndex]
                    ],
                    [
                        l.f.shiftsDegreeZero[startIndex],
                        l.f.shiftsDegreeOne[startIndex],
                        l.f.shiftsDegreeTwo[startIndex],
                        l.f.shiftsDegreeThree[startIndex]
                    ],
                    [
                        l.f.boolsDegreeZero[startIndex],
                        l.f.boolsDegreeOne[startIndex],
                        l.f.boolsDegreeTwo[startIndex],
                        l.f.boolsDegreeThree[startIndex]
                    ]
                );

                //add the middle parts
                if (endIndex > (startIndex + 1)) {
                    for (uint8 i = 1; i <= (endIndex - startIndex - 1); i++) {
                        amountBeans += l.f.intervalIntegrations[startIndex + i];
                    }
                }

                //add the end part
                amountBeans += MathFP.evaluateDefiniteIntegralCubic(
                    l.f.subIntervalIndex[endIndex],
                    placeInLine + beanAmount,
                    l.f.subIntervalIndex[endIndex],
                    true,
                    [
                        l.f.constantsDegreeZero[endIndex],
                        l.f.constantsDegreeOne[endIndex],
                        l.f.constantsDegreeTwo[endIndex],
                        l.f.constantsDegreeThree[endIndex]
                    ],
                    [
                        l.f.shiftsDegreeZero[endIndex],
                        l.f.shiftsDegreeOne[endIndex],
                        l.f.shiftsDegreeTwo[endIndex],
                        l.f.shiftsDegreeThree[endIndex]
                    ],
                    [
                        l.f.boolsDegreeZero[endIndex],
                        l.f.boolsDegreeOne[endIndex],
                        l.f.boolsDegreeTwo[endIndex],
                        l.f.boolsDegreeThree[endIndex]
                    ]
                );
            }
            amountBeans = amountBeans / 1000000;
        }

        //Need to fix rounding function
        // amountBeans = roundAmount(l.amount, amountBeans);

        __fillListing(l.account, msg.sender, l, amountBeans);
        _transferPlot(l.account, msg.sender, l.index, l.start, amountBeans);
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
                l.toWallet,
                l.constantPricing,
                l.f.subIntervalIndex,
                l.f.intervalIntegrations,
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
        bool toWallet,
        bool constantPricing,
        uint256[10] memory subIntervalIndex,
        uint256[9] memory intervalIntegrations,
        uint240[10] memory constantsDegreeZero,
        uint8[10] memory shiftsDegreeZero,
        bool[10] memory boolsDegreeZero,
        uint240[10] memory constantsDegreeOne,
        uint8[10] memory shiftsDegreeOne,
        bool[10] memory boolsDegreeOne,
        uint240[10] memory constantsDegreeTwo,
        uint8[10] memory shiftsDegreeTwo,
        bool[10] memory boolsDegreeTwo,
        uint240[10] memory constantsDegreeThree,
        uint8[10] memory shiftsDegreeThree,
        bool[10] memory boolsDegreeThree
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(
                start,
                amount,
                pricePerPod,
                maxHarvestableIndex,
                toWallet,
                constantPricing,
                subIntervalIndex,
                intervalIntegrations,
                constantsDegreeZero,
                shiftsDegreeZero,
                boolsDegreeZero,
                constantsDegreeOne,
                shiftsDegreeOne,
                boolsDegreeOne,
                constantsDegreeTwo,
                shiftsDegreeTwo,
                boolsDegreeTwo,
                constantsDegreeThree,
                shiftsDegreeThree,
                boolsDegreeThree
            )
        );
    }
}
