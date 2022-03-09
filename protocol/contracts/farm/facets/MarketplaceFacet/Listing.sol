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
    uint256 constant eN = 271828;
    uint256 constant eD = 100000;
    uint256 constant unit = MathFPSigned.unit(37);
    using SafeMath for uint256;
    
    struct Formula {
        //store coefficients as our own implementation of a fixed point where we store the decimal shift
        // our decimal coefficient + decimal shift will be combined into another uint128
        // so then our product is garaunteed to be uint256
        uint120 a; //15 max uint120 is 10^36
        uint8 aShift; //1
        uint120 b; //15
        uint8 bShift; //1
        uint120 c; //15
        uint8 cShift; //1
        uint120 d; //15
        uint8 dShift; //1
    }

    struct Listing {
        address account; //20
        uint256 index; //32
        uint256 start; //32
        uint256 amount; //32
        uint24 pricePerPod; //3 -> starting price
        uint256 maxHarvestableIndex; // expiry
        bool toWallet;
        uint8 functionType;  // 0 = constant, 1 = linear, 2 = log, 3 = sigmoid, 4 = poly 2, 5 = poly 3, 6 = poly 4
        Formula f;
    }

    event PodListingCreated(
        address indexed account, 
        uint256 index, 
        uint256 start, 
        uint256 amount, 
        uint24 pricePerPod, 
        uint256 maxHarvestableIndex, 
        bool toWallet,
        uint8 functionType,
        uint120[3] f, //store the formula's coefs in an array
        uint8[3] fShifts //store corresponding shifts in array
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
        uint8 functionType,
        Formula f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        //price per pod has to be calculated
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(index);
        //update hash to include formula
        s.podListings[index] = hashListing(start, amount, pricePerPod, maxHarvestableIndex, toWallet, functionType, [f.a,f.b,f.c], [f.aShift, f.bShift, f.cShift]);

        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, toWallet,l.functionType, [f.a,f.b,f.c], [f.aShift, f.bShift, f.cShift]);
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
        bytes32 lHash = hashListing(l.start, l.amount, l.pricePerPod, l.maxHarvestableIndex, l.toWallet, l.functionType, [l.f.a,l.f.b,l.f.c], [l.f.aShift, l.f.bShift, l.f.cShift]);
        require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");
        uint256 plotSize = s.a[l.account].field.plots[l.index];
        require(plotSize >= (l.start + l.amount) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");
        require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");
        // calculate price per pod here
        // uint256 amount = (beanAmount * 1000000) / l.pricePerPod;
        uint256 amount;
        if (l.functionType == 0) {
            amount = getListingAmountConst(l, beanAmount);
        }
        else if (l.functionType == 1) {
            amount = getListingAmountLin(l, l.f, beanAmount);
        } 
        else if (l.functionType == 2) {
            amount = getListingAmountLog(l, l.f, beanAmount);
        }
        else if (l.functionType == 3) {
            amount = getListingAmountSig(l, l.f, beanAmount);
        }
        else if (l.functionType == 4) {
            amount = getListingAmountPoly(l, l.f, beanAmount);
        }
        amount = roundAmount(l, amount);

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
                                    l.toWallet
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
        Listing calldata l,
        uint256 amount
    )  pure private returns (uint256) {
        if ((l.amount - amount) < (1000000 / l.pricePerPod))
            amount = l.amount;
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
        uint8 functionType,
        uint120[3] f,
        uint8[3] fShifts
    ) pure internal returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex, toWallet, functionType, f, fShifts)
        );
    }

    function getListingAmountConst(Listing calldata l, uint256 amount) pure internal returns (uint256) {

        return amount * 1000000 / l.pricePerPod; // units: 1000000 = 1
    }

    function getListingAmountLin(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; // units: 1 
        uint256 a = f.a.mul(10**(37-f.aShift)); // 1eU
        uint256 pricePerPod = a.mul(x) + (l.pricePerPod * unit) / 1000000;
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount); //units will be 1e36
    }

    function getListingAmountLog(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; // units: 1 
        uint256 a = f.a.mul(10**(37-f.aShift));// 1eU
        uint256 pricePerPod = log_two((placeInLine + 1).mul(unit)).divdrup(log_two(a)) +( l.pricePerPod * unit) / 1000000;
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount);
    }

    function getListingAmountSig(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; // units: 1 
        uint256 a = f.a.mul(10**(37-f.aShift));
        uint256 pricePerPod = ((l.pricePerPod * 2 / 1000000) * unit) / (1 + (eN / eD)**(a.mul(placeInLine) * -1));
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount);
    }

    function getListingAmountPoly(Listing calldata l, Formula calldata f, uint256 amount) internal returns (uint256) {
        uint256 placeInLine = l.index - s.f.harvestable; //units: 1
        uint256 a = f.a.mul(10**(37-f.aShift));
        uint256 pricePerPod = a.mul(x) + (l.pricePerPod * unit) / 1000000;
        if (f.b > 0) {
            uint128 b = f.b.mul(10**(37-f.bShift));
            pricePerPod += b.mul(x**2);
        }
        if (f.c > 0) {
            uint128 c = f.c.mul(10**(37-cShift));
            pricePerPod += c.mul(x**3);
        }
        amount = amount * unit / pricePerPod;
        return roundAmount(l, amount);
    }
}