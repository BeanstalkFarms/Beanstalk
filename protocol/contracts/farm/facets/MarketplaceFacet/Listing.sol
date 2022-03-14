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
    using SafeMath for uint256;
    
    struct Formula {
        //store coefficients as our own implementation of a fixed point where we store the decimal shift
        // our decimal coefficient + decimal shift will be combined into another uint128
        // so then our product is garaunteed to be uint256
        // all coefficients in the Formula struct will be fixed to 46 digits of precision 
        // this is so (1e13)^4 which is 1e52 can be reduced down to a 1e6 
        // the coefficient "a" is assumed to be the coefficient for the lowest order
        // the other values are only used in polynomial and wont be checked otherwise
        uint240 a; // 30 bytes
        uint8 aShift; // 1 bytes
        bool aSign; // 1 byte
        uint240 b; 
        uint8 bShift; 
        bool bSign;
        uint240 c;
        uint8 cShift;
        bool cSign;
        uint240 d; 
        uint8 dShift;
        bool dSign;
    }

    struct Listing {
        address account; //20
        uint256 index; //32
        uint256 start; //32
        uint256 amount; //32
        uint24 pricePerPod; //3 -> starting price
        uint256 maxHarvestableIndex; // expiry
        bool toWallet;
        uint8 fType;  // 0 = constant, 1 = linear, 2 = log, 3 = sigmoid, 4 = poly 2, 5 = poly 3, 6 = poly 4
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
        uint8 fType,
        uint240[4] fValues, //store the formula's coefs in an array
        uint8[4] fShifts, //store corresponding shifts in array
        bool[4] fSigns
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
        uint8 fType,
        Formula calldata f
    ) internal {
        uint256 plotSize = s.a[msg.sender].field.plots[index];
        require(plotSize >= (start + amount) && amount > 0, "Marketplace: Invalid Plot/Amount.");
        //price per pod has to be calculated
        require(0 < pricePerPod, "Marketplace: Pod price must be greater than 0.");
        require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

        if (s.podListings[index] != bytes32(0)) _cancelPodListing(index);

        s.podListings[index] = hashListing(
            start, 
            amount, 
            pricePerPod, 
            maxHarvestableIndex, 
            toWallet, 
            fType, 
            [f.a, f.b, f.c, f.d], 
            [f.aShift, f.bShift, f.cShift, f.dShift],
            [f.aSign, f.bSign, f.cSign, f.dSign]
        );

        emit PodListingCreated(msg.sender, index, start, amount, pricePerPod, maxHarvestableIndex, toWallet,fType, [f.a, f.b, f.c, f.d], [f.aShift, f.bShift, f.cShift, f.dShift], [f.aShift, f.bSign, f.cSign, f.dSign]);
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
            l.fType, 
            [l.f.a, l.f.b, l.f.c, l.f.d], 
            [l.f.aShift, l.f.bShift, l.f.cShift, l.f.dShift],
            [l.f.aSign, l.f.bSign, l.f.cSign, l.f.dSign]
        );
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
            amount = getListingAmountLin(l, beanAmount);
        } 
        else if (l.functionType == 2) {
            amount = getListingAmountLog(l, beanAmount);
        }
        else if (l.functionType == 3) {
            amount = getListingAmountSig(l, beanAmount);
        }
        else if (l.functionType == 4) {
            amount = getListingAmountPoly(l, beanAmount);
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
        uint8 fType,
        uint240[4] memory f,
        uint8[4] memory fShifts,
        bool[4] memory fSigns
    ) pure internal returns (bytes32 lHash) {
        lHash = keccak256(
            abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex, toWallet, functionType, f, fShifts, fSigns)
        );
    }

    function getListingAmountConst(Listing calldata l, uint256 amount) pure internal returns (uint256 amount) {
        amount = amount * l.pricePerPod; // units: 1000000 = 1
    }

    function getListingAmountLin(Listing calldata l, uint256 amount) internal returns (uint256) {
        uint256 x = l.index + l.start + (amount / 2) - s.f.harvestable; // x is 1e13, divide it by 1e5 to get a number with upper bounds at 1e8
        
        //fixed point assuming decimal shift
        // place in line needs to be 1e13 -> 1e8
        // 10,000,000,000,000
        // set 10 trillion 
        // use the muld with the third parameter being the shift
        // product of x and a should be 1e6 (so only first 6 digits matter)
        uint256 pricePerPod;
        if (l.f.aSign) {
            pricePerPod = MathFP.muld(x, l.f.a, l.f.aShift) + l.pricePerPod;
        } else {
            pricePerPod = l.pricePerPod - MathFP.muld(x, l.f.a, l.f.aShift);
        }

        amount = amount * pricePerPod;
        return roundAmount(l, amount);
    }

    function getListingAmountLog(Listing calldata l,uint256 amount) internal returns (uint256) {
        uint256 x = l.index + l.start + (amount / 2) - s.f.harvestable;

        uint256 log1 = LibIncentive.log_two(x+1);
        uint256 log2 = LibIncentive.log_two(l.f.a);

        uint256 pricePerPod = MathFP.divdr(log1, log2, l.f.aShift) + l.pricePerPod;
        
        amount = amount * pricePerPod;
        return roundAmount(l, amount);

    }

    // error in denominator: a uint cannot be multiplied by -1. is there an abs() type function we can use? 
    // calculating the x for this function -> x intends to be the starting index for the plot
    function getListingAmountSig(Listing calldata l, uint256 amount) internal returns (uint256) {
        uint256 x = l.index + l.start + (amount / 2) - s.f.harvestable;

        uint256 n = l.pricePerPod * 2;
        uint256 d;

        if (l.f.aSign){
            d = (1 + (eN / eD)**(-1 * MathFP.muld(x, l.f.a, l.f.aShift)));
        } else {
            d = (1 + (eN / eD)**(MathFP.muld(x, l.f.a, l.f.aShift)));
        }
       
        uint256 pricePerPod = n / d; // not sure if this is ok
        amount = amount * pricePerPod;

        return roundAmount(l, amount);
    }

    function getListingAmountPoly(Listing calldata l, uint256 amount) internal returns (uint256) {
        uint256 x = l.index + l.start + (amount / 2) - s.f.harvestable;

        uint256 pricePerPod;

        if (l.f.aSign) {
            pricePerPod = MathFP.muld(x, l.f.a, l.f.aShift) + l.pricePerPod;
        } else {
            pricePerPod = l.pricePerPod - MathFP.muld(x, l.f.a, l.f.aShift);
        }
        
        if (l.f.b > 0) {
            if (l.f.bSign) {
                pricePerPod += MathFP.muld(x**2, l.f.b, l.f.bShift);
            }
            else {
                pricePerPod -= MathFP.muld(x**2, l.f.b, l.f.bShift);
            }
        }
        if (l.f.c > 0) {
            if (l.f.cSign) {
                pricePerPod += MathFP.muld(x**3, l.f.c, l.f.cShift);
            }
            else {
                pricePerPod -= MathFP.muld(x**3, l.f.c, l.f.cShift);
            }
        }
        if (l.f.d > 0) {
            if (l.f.dSign) {
                pricePerPod += MathFP.muld(x**4, l.f.d, l.f.dShift);
            }
            else {
                pricePerPod -= MathFP.muld(x**4, l.f.d, l.f.dShift);
            }
        }
        amount = amount * pricePerPod;
        return roundAmount(l, amount);
    }
}