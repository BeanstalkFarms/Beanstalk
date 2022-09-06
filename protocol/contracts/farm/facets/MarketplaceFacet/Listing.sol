/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./PodTransfer.sol";
import "../../../libraries/Token/LibTransfer.sol";
import "../../../libraries/LibPolynomial.sol";
import "hardhat/console.sol";

/**
 * @author Beanjoyer
 * @title Pod Marketplace v1
 **/

contract Listing is PodTransfer {

    using SafeMath for uint256;

    event NewCubicPiecewise4(
        uint256[4] piecewiseBreakpoints,
        uint256[16] coefficientSignificands,
        uint256 packedCoefficientExponents,
        uint256 packedCoefficientSigns
    );

    event NewCubicPiecewise16(
        uint256[16] piecewiseBreakpoints,
        uint256[64] coefficientSignificands,
        uint256[2] packedCoefficientExponents,
        uint256 packedCoefficientSigns
    );

    event NewCubicPiecewise64(
        uint256[64] piecewiseBreakpoints,
        uint256[256] coefficientSignificands,
        uint256[8] packedCoefficientExponents,
        uint256 packedCoefficientSigns
    );

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
        LibTransfer.To mode,
        LibPolynomial.PriceType priceType
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
        
        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, mode, LibPolynomial.PriceType.Fixed);

    }

    function _createPodListingPiecewise4(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        LibPolynomial.CubicPiecewise4 calldata f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];

        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListingPiecewise4(
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
        
        emit PodListingCreated(
            msg.sender, 
            index, 
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            mode, 
            LibPolynomial.PriceType.Piecewise4
        );

        emit NewCubicPiecewise4(
            f.breakpoints, 
            f.significands, 
            f.packedExponents,
            f.packedSigns
        );
    }

    function _createPodListingPiecewise16(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        LibPolynomial.CubicPiecewise16 calldata f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];

        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListingPiecewise16(
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
        
        emit PodListingCreated(
            msg.sender, 
            index, 
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            mode, 
            LibPolynomial.PriceType.Piecewise16
        );

        emit NewCubicPiecewise16(
            f.breakpoints, 
            f.significands, 
            f.packedExponents,
            f.packedSigns
        );
    }

    function _createPodListingPiecewise64(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        LibPolynomial.CubicPiecewise64 calldata f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];

        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hashListingPiecewise64(
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

        emit PodListingCreated(
            msg.sender, 
            index, 
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            mode, 
            LibPolynomial.PriceType.Piecewise64
        );

        emit NewCubicPiecewise64(
            f.breakpoints, 
            f.significands, 
            f.packedExponents,
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

    function _fillListingPiecewise4(
        PodListing calldata l, 
        LibPolynomial.CubicPiecewise4 calldata f, 
        uint256 beanAmount
    ) internal {
        bytes32 lHash = hashListingPiecewise4(
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

        uint256 amount = getRoundedAmountPiecewise4(l, f, beanAmount);

        __fillListingPiecewise4(msg.sender, l, f, amount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function _fillListingPiecewise16(
        PodListing calldata l, 
        LibPolynomial.CubicPiecewise16 calldata f, 
        uint256 beanAmount
    ) internal {
        bytes32 lHash = hashListingPiecewise16(
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

        uint256 amount = getRoundedAmountPiecewise16(l, f, beanAmount);

        __fillListingPiecewise16(msg.sender, l, f, amount);
        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function _fillListingPiecewise64(
        PodListing calldata l, 
        LibPolynomial.CubicPiecewise64 calldata f, 
        uint256 beanAmount
    ) internal {
        bytes32 lHash = hashListingPiecewise64(
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

        uint256 amount = getRoundedAmountPiecewise64(l, f, beanAmount);

        __fillListingPiecewise64(msg.sender, l, f, amount);

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

    function __fillListingPiecewise4(
        address to,
        PodListing calldata l,
        LibPolynomial.CubicPiecewise4 calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashListingPiecewise4(
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

    function __fillListingPiecewise16(
        address to,
        PodListing calldata l,
        LibPolynomial.CubicPiecewise16 calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashListingPiecewise16(
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

    function __fillListingPiecewise64(
        address to,
        PodListing calldata l,
        LibPolynomial.CubicPiecewise64 calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hashListingPiecewise64(
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

    function getRoundedAmountPiecewise4(
        PodListing calldata l, 
        LibPolynomial.CubicPiecewise4 calldata f, 
        uint256 beanAmount
    ) public view returns (uint256 amount) {
        uint256 pricePerPod = LibPolynomial.evaluatePolynomialPiecewise4(f, l.index + l.start - s.f.harvestable);
        amount = (beanAmount * 1000000) / pricePerPod;
        
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = l.amount;
    }

    function getRoundedAmountPiecewise16(
        PodListing calldata l, 
        LibPolynomial.CubicPiecewise16 calldata f, 
        uint256 beanAmount
    ) public view returns (uint256 amount) {
        uint256 pricePerPod = LibPolynomial.evaluatePolynomialPiecewise16(f, l.index + l.start - s.f.harvestable);
        amount = (beanAmount * 1000000) / pricePerPod;
        
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = l.amount;
    }

    function getRoundedAmountPiecewise64(
        PodListing calldata l, 
        LibPolynomial.CubicPiecewise64 calldata f, 
        uint256 beanAmount
    ) public view returns (uint256 amount) {
        uint256 pricePerPod = LibPolynomial.evaluatePolynomialPiecewise64(f, l.index + l.start - s.f.harvestable);
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

    function hashListingPiecewise4(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode, 
        uint256[4] calldata breakpoints,
        uint256[16] calldata significands, 
        uint256 packedExponents, 
        uint256 packedSigns
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, breakpoints, significands, packedExponents, packedSigns));
    }

    function hashListingPiecewise16(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode, 
        uint256[16] calldata breakpoints,
        uint256[64] calldata significands, 
        uint256[2] calldata packedExponents, 
        uint256 packedSigns
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, breakpoints, significands, packedExponents, packedSigns));
    }

    function hashListingPiecewise64(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode, 
        uint256[64] calldata breakpoints,
        uint256[256] calldata significands, 
        uint256[8] calldata packedExponents, 
        uint256 packedSigns
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, breakpoints, significands, packedExponents, packedSigns));
    }

}
