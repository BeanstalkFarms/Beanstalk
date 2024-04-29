/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./PodTransfer.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/libraries/LibPolynomial.sol";
import "contracts/libraries/LibTractor.sol";

/**
 * @author Beanjoyer, Malteasy
 * @title Pod Marketplace
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
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal {
        uint256 plotSize = s.a[LibTractor._user()].field.plots[index];

        require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(LibTractor._user(), index);

        s.podListings[index] = hashListing(
            start,
            amount,
            0,
            maxHarvestableIndex,
            minFillAmount,
            pricingFunction,
            mode
        );

        emit PodListingCreated(
            LibTractor._user(),
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

    function _fillListing(
        PodListing calldata l,
        uint256 beanAmount,
        bytes calldata pricingFunction
    ) internal {
        bytes32 lHash = hashListing(
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

        require(
            plotSize >= (l.start.add(l.amount)) && l.amount > 0,
            "Marketplace: Invalid Plot/Amount."
        );
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

        uint256 amount = getAmountPodsFromFillListing(
            l.index.add(l.start).sub(s.f.harvestable),
            l.amount,
            beanAmount,
            pricingFunction
        );

        __fillListing(LibTractor._user(), l, pricingFunction, amount, beanAmount);
        _transferPlot(l.account, LibTractor._user(), l.index, l.start, amount);
    }

    function __fillListing(
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
            s.podListings[l.index.add(amount).add(l.start)] = hashListing(
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
        require(s.a[account].field.plots[index] > 0, "Marketplace: Listing not owned by sender.");

        delete s.podListings[index];

        emit PodListingCancelled(account, index);
    }

    /*
     * Helpers
     */

    function getAmountPodsFromFillListing(
        uint256 placeInLine,
        uint256 podListingAmount,
        uint256 fillBeanAmount,
        bytes calldata pricingFunction
    ) public pure returns (uint256 amount) {
        uint256 pricePerPod = LibPolynomial.evaluatePolynomialPiecewise(
            pricingFunction,
            placeInLine
        );
        amount = (fillBeanAmount.mul(1000000)) / pricePerPod;

        uint256 remainingAmount = podListingAmount.sub(
            amount,
            "Marketplace: Not enough pods in Listing."
        );
        if (remainingAmount <= (1000000 / pricePerPod)) amount = podListingAmount;
    }

    function hashListing(
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        bytes calldata pricingFunction,
        LibTransfer.To mode
    ) internal pure returns (bytes32 lHash) {
        require(
            pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32),
            "Marketplace: Invalid pricing function."
        );
        lHash = keccak256(
            abi.encodePacked(
                start,
                amount,
                pricePerPod,
                maxHarvestableIndex,
                minFillAmount,
                mode == LibTransfer.To.EXTERNAL,
                pricingFunction
            )
        );
    }
}
