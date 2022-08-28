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

    event DynamicPodListingCreated_4Pieces(
        address indexed account,
        uint256 index, 
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        uint256[4] pieceBreakpoints,
        uint256[16] polynomialCoefficients,
        uint256 packedPolynomialExponents,
        uint256 packedPolynomialSigns
    );

    event DynamicPodListingCreated_16Pieces(
        address indexed account,
        uint256 index, 
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        uint256[16] pieceBreakpoints,
        uint256[64] polynomialCoefficients,
        uint256[2] packedPolynomialExponents,
        uint256 packedPolynomialSigns
    );

    event DynamicPodListingCreated_64Pieces(
        address indexed account,
        uint256 index, 
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        uint256[64] pieceBreakpoints,
        uint256[256] polynomialCoefficients,
        uint256[8] packedPolynomialExponents,
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

    function _create4PiecesDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial_4 calldata f
    ) internal {

        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hash4PiecesDynamicListing(
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
        
        emit DynamicPodListingCreated_4Pieces(
            msg.sender, 
            index, 
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
    }

    function _create16PiecesDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial_16 calldata f
    ) internal {

        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hash16PiecesDynamicListing(
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
        
        emit DynamicPodListingCreated_16Pieces(
            msg.sender, 
            index, 
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
    }

    function _create64PiecesDynamicPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        LibTransfer.To mode,
        PiecewisePolynomial_64 calldata f
    ) internal {

        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");
        
        if (s.podListings[index] != bytes32(0)) _cancelPodListing(msg.sender, index);

        s.podListings[index] = hash64PiecesDynamicListing(
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

        emit DynamicPodListingCreated_64Pieces(
            msg.sender, 
            index, 
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

    function _fill4PiecesDynamicListing(PodListing calldata l, PiecewisePolynomial_4 calldata f, uint256 beanAmount) internal {

        bytes32 lHash = hash4PiecesDynamicListing(
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

        uint256 amount = get4PiecesDynamicRoundedAmount(l, f, beanAmount);

        __fill4PiecesDynamicListing(msg.sender, l, f, amount);

        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function _fill16PiecesDynamicListing(PodListing calldata l, PiecewisePolynomial_16 calldata f, uint256 beanAmount) internal {

        bytes32 lHash = hash16PiecesDynamicListing(
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

        uint256 amount = get16PiecesDynamicRoundedAmount(l, f, beanAmount);

        __fill16PiecesDynamicListing(msg.sender, l, f, amount);

        _transferPlot(l.account, msg.sender, l.index, l.start, amount);

    }

    function _fill64PiecesDynamicListing(PodListing calldata l, PiecewisePolynomial_64 calldata f, uint256 beanAmount) internal {

        bytes32 lHash = hash64PiecesDynamicListing(
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

        uint256 amount = get64PiecesDynamicRoundedAmount(l, f, beanAmount);

        __fill64PiecesDynamicListing(msg.sender, l, f, amount);

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

    function __fill4PiecesDynamicListing(
        address to,
        PodListing calldata l,
        PiecewisePolynomial_4 calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hash4PiecesDynamicListing(
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

    function __fill16PiecesDynamicListing(
        address to,
        PodListing calldata l,
        PiecewisePolynomial_16 calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hash16PiecesDynamicListing(
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

    function __fill64PiecesDynamicListing(
        address to,
        PodListing calldata l,
        PiecewisePolynomial_64 calldata f,
        uint256 amount
    ) private {
        require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");
        if (l.amount > amount) {
            s.podListings[l.index.add(amount).add(l.start)] = hash64PiecesDynamicListing(
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

    function get4PiecesDynamicRoundedAmount(PodListing calldata l, PiecewisePolynomial_4 calldata f, uint256 beanAmount) internal view returns (uint256 amount) {
        uint256 numPieces = getNumPiecesFrom4(f.breakpoints);
        uint256 pieceIndex = findPieceIndexFrom4(f.breakpoints, beanAmount, numPieces - 1);
        uint24 pricePerPod = uint24(
            _evaluatePolynomial(
                [f.significands[pieceIndex], f.significands[pieceIndex + 1], f.significands[pieceIndex + 2], f.significands[pieceIndex + 3]], 
                getPackedExponents(f.packedExponents, pieceIndex),
                getPackedSigns(f.packedSigns, pieceIndex),
                l.index + l.start - s.f.harvestable
            )
        );
        amount = (beanAmount * 1000000) / pricePerPod;
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = l.amount;
    }

    function get16PiecesDynamicRoundedAmount(PodListing calldata l, PiecewisePolynomial_16 calldata f, uint256 beanAmount) internal view returns (uint256 amount) {
        uint256 numPieces = getNumPiecesFrom16(f.breakpoints);
        uint256 pieceIndex = findPieceIndexFrom16(f.breakpoints, beanAmount, numPieces - 1);
        uint24 pricePerPod = uint24(
            _evaluatePolynomial(
                [f.significands[pieceIndex], f.significands[pieceIndex + 1], f.significands[pieceIndex + 2], f.significands[pieceIndex + 3]], 
                getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex),
                getPackedSigns(f.packedSigns, pieceIndex),
                l.index + l.start - s.f.harvestable
            )
        );
        amount = (beanAmount * 1000000) / pricePerPod;
        uint256 remainingAmount = l.amount.sub(amount, "Marketplace: Not enough pods in Listing.");
        if(remainingAmount <= (1000000 / pricePerPod)) amount = l.amount;
    }

    function get64PiecesDynamicRoundedAmount(PodListing calldata l, PiecewisePolynomial_64 calldata f, uint256 beanAmount) internal view returns (uint256 amount) {
        uint256 numPieces = getNumPiecesFrom64(f.breakpoints);
        uint256 pieceIndex = findPieceIndexFrom64(f.breakpoints, beanAmount, numPieces - 1);
        uint24 pricePerPod = uint24(
            _evaluatePolynomial(
                [f.significands[pieceIndex], f.significands[pieceIndex + 1], f.significands[pieceIndex + 2], f.significands[pieceIndex + 3]], 
                getPackedExponents(f.packedExponents[pieceIndex / 8], pieceIndex),
                getPackedSigns(f.packedSigns, pieceIndex),
                l.index + l.start - s.f.harvestable
            )
        );
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

    function hash1PieceDynamicListing(
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        LibTransfer.To mode, 
        uint256[4] calldata significands, 
        uint256 packedExponents, 
        uint256 packedSigns
    ) internal pure returns (bytes32 lHash) {
        lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL, significands, packedExponents, packedSigns));
    }

    function hash4PiecesDynamicListing(
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

    function hash16PiecesDynamicListing(
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

    function hash64PiecesDynamicListing(
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
