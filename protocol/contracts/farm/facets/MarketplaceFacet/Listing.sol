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
        uint256 maxHarvestableIndex; // expiry
        uint24 pricePerPod; //3 -> starting price
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
        uint256[40] constants,
        uint8[40] shifts,
        bool[40] bools
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
            f.constants,
            f.shifts,
            f.bools
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
            f.constants,
            f.shifts,
            f.bools
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
            l.f.constants,
            l.f.shifts,
            l.f.bools
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
        // uint256 placeInLine = l.index + l.start - s.f.harvestable;

        if (l.constantPricing) {
            //if constant pricing for all pods, the amount is calculated by dividing the amount of beans by the price per pod
            amountBeans = (beanAmount * 1000000) / l.pricePerPod;
        } else {
            // calculate price per pod

            uint256 i = MathFP.findIndexWithinSubinterval(
                l.f.subIntervalIndex,
                l.index + l.start - s.f.harvestable
            );

            // amountBeans = (beanAmount * 1000000) / MathFP.evaluateCubic(
            //     l.f.bools[i],
            //     l.f.bools[i + 10],
            //     l.f.bools[i + 20],
            //     l.f.bools[i + 30],
            //     l.f.shifts[i],
            //     l.f.shifts[i + 10],
            //     l.f.shifts[i + 20],
            //     l.f.shifts[i + 30],
            //     l.f.constants[i],
            //     l.f.constants[i + 10],
            //     l.f.constants[i + 20],
            //     l.f.constants[i + 30],
            //     l.index + l.start - s.f.harvestable
            // );
            amountBeans = MathFP.evaluateCubic(
                [
                    l.f.bools[i],
                    l.f.bools[i + 10],
                    l.f.bools[i + 20],
                    l.f.bools[i + 30]
                ],
                [
                    l.f.shifts[i],
                    l.f.shifts[i + 10],
                    l.f.shifts[i + 20],
                    l.f.shifts[i + 30]
                ],
                [
                    l.f.constants[i],
                    l.f.constants[i + 10],
                    l.f.constants[i + 20],
                    l.f.constants[i + 30]
                ],
                l.index + l.start - s.f.harvestable
            );
        }

        //Need to fix rounding function
        // amountBeans = roundAmount(l.amount, amountBeans);
        __fillListing(l.account, msg.sender, l, amountBeans);
        _transferPlot(l.account, msg.sender, l.index, l.start, amountBeans);
    }

    function _integrateCubic(
        MathFP.PiecewiseFormula calldata f,
        uint256 k,
        uint256 i,
        uint256 endI
    ) internal pure returns (uint256) {
        require(i >= endI);
        if (i == endI) {
            return
                MathFP.integrateCubic(
                    [
                        f.bools[i],
                        f.bools[i + 10],
                        f.bools[i + 20],
                        f.bools[i + 30]
                    ],
                    [
                        f.shifts[i],
                        f.shifts[i + 10],
                        f.shifts[i + 20],
                        f.shifts[i + 30]
                    ],
                    [
                        f.constants[i],
                        f.constants[i + 10],
                        f.constants[i + 20],
                        f.constants[i + 30]
                    ],
                    k
                );
        } else {
            uint256 midSum;
            if (endI > (i + 1)) {
                for (uint8 j = 1; j <= (endI - i - 1); i++) {
                    midSum += MathFP.integrateCubic(
                        [
                            f.bools[i + j],
                            f.bools[i + j + 10],
                            f.bools[i + j + 20],
                            f.bools[i + j + 30]
                        ],
                        [
                            f.shifts[i + j],
                            f.shifts[i + j + 10],
                            f.shifts[i + j + 20],
                            f.shifts[i + j + 30]
                        ],
                        [
                            f.constants[i + j],
                            f.constants[i + i + 10],
                            f.constants[i + i + 20],
                            f.constants[i + i + 30]
                        ],
                        f.subIntervalIndex[i + j + 1] -
                            f.subIntervalIndex[i + i]
                    );
                }
                return
                    MathFP.integrateCubic(
                        [
                            f.bools[i],
                            f.bools[i + 10],
                            f.bools[i + 20],
                            f.bools[i + 30]
                        ],
                        [
                            f.shifts[i],
                            f.shifts[i + 10],
                            f.shifts[i + 20],
                            f.shifts[i + 30]
                        ],
                        [
                            f.constants[i],
                            f.constants[i + 10],
                            f.constants[i + 20],
                            f.constants[i + 30]
                        ],
                        k
                    ) +
                    midSum +
                    MathFP.integrateCubic(
                        [
                            f.bools[endI],
                            f.bools[endI + 10],
                            f.bools[endI + 20],
                            f.bools[endI + 30]
                        ],
                        [
                            f.shifts[endI],
                            f.shifts[endI + 10],
                            f.shifts[endI + 20],
                            f.shifts[endI + 30]
                        ],
                        [
                            f.constants[endI],
                            f.constants[endI + 10],
                            f.constants[endI + 20],
                            f.constants[endI + 30]
                        ],
                        k - f.subIntervalIndex[endI]
                    );
            } else {
                return
                    MathFP.integrateCubic(
                        [
                            f.bools[i],
                            f.bools[i + 10],
                            f.bools[i + 20],
                            f.bools[i + 30]
                        ],
                        [
                            f.shifts[i],
                            f.shifts[i + 10],
                            f.shifts[i + 20],
                            f.shifts[i + 30]
                        ],
                        [
                            f.constants[i],
                            f.constants[i + 10],
                            f.constants[i + 20],
                            f.constants[i + 30]
                        ],
                        k
                    ) +
                    MathFP.integrateCubic(
                        [
                            f.bools[endI],
                            f.bools[endI + 10],
                            f.bools[endI + 20],
                            f.bools[endI + 30]
                        ],
                        [
                            f.shifts[endI],
                            f.shifts[endI + 10],
                            f.shifts[endI + 20],
                            f.shifts[endI + 30]
                        ],
                        [
                            f.constants[endI],
                            f.constants[endI + 10],
                            f.constants[endI + 20],
                            f.constants[endI + 30]
                        ],
                        k - f.subIntervalIndex[endI]
                    );
            }
        }
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
                l.f.constants,
                l.f.shifts,
                l.f.bools
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
        uint256[40] memory constants,
        uint8[40] memory shifts,
        bool[40] memory bools
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
                constants,
                shifts,
                bools
            )
        );
    }
}
