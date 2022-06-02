/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibAppStorage.sol";
import "./LibSafeMath32.sol";
import "../C.sol";
import "./LibUnripe.sol";

/**
 * @author Publius
 * @title Fertilizer
 **/

library LibFertilizer {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event SetFertilizer(uint32 id, uint32 bpf);

    // 6 - 3
    uint32 private constant PADDING = 1e3;
    uint32 private constant DECIMALS = 1e6;
    uint32 private constant REPLANT_SEASON = 6074;
    uint32 private constant RESTART_HUMIDITY = 2500;
    uint32 private constant END_DECREASE_SEASON = REPLANT_SEASON + 461;

    function addFertilizer(uint32 season, uint128 amount, uint256 minLP) internal returns (uint32 id) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 _amount = uint256(amount);
        // Calculate Beans Per Fertilizer and add to total owed
        uint32 bpf = getBpf(season);
        s.unfertilizedIndex = s.unfertilizedIndex.add(_amount.mul(uint128(bpf)));
        // Get id
        id = s.bpf.add(bpf);
        // Update Total and Season supply
        s.fertilizer[id] = s.fertilizer[id].add(amount);
        s.activeFertilizer = s.activeFertilizer.add(_amount);
        // Add underlying to Unripe Beans and Unripe LP
        addUnderlying(_amount.mul(DECIMALS), minLP);
        // If not first time adding Fertilizer with this id, return
        if (s.fertilizer[id] > amount) return id;
        // If first time, log end Beans Per Fertilizer and add to Season queue.
        LibFertilizer.push(id);
        emit SetFertilizer(id, bpf);
    }

    function getBpf(uint32 id) internal pure returns (uint32 bpf) {
        bpf = getHumidity(id).add(1000).mul(PADDING);
    }

    function getHumidity(uint32 id) internal pure returns (uint32 humidity) {
        if (id == REPLANT_SEASON) return 5000;
        if (id >= END_DECREASE_SEASON) return 200;
        uint32 humidityDecrease = id.sub(REPLANT_SEASON+1).mul(5);
        humidity = RESTART_HUMIDITY.sub(humidityDecrease);
    }

    function addUnderlying(uint256 amount, uint256 minAmountOut) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Calculate how many new Deposited Beans will be minted
        uint256 percentToFill = amount.mul(C.precision()).div(remainingRecapitalization());
        uint256 newDepositedBeans = (C.unripeBean().totalSupply()).sub(s.u[C.unripeBeanAddress()].balanceOfUnderlying);
        newDepositedBeans = newDepositedBeans.mul(percentToFill).div(C.precision());
        // Calculate how many Beans to add as LP
        uint256 newDepositedLPBeans = amount.mul(C.exploitAddLPRatio()).div(DECIMALS);
        // Mint the Beans
        C.bean().mint(address(this), newDepositedBeans.add(newDepositedLPBeans));
        // Add Liquidity
        uint256 newLP = C.curveZap().add_liquidity(C.curveMetapoolAddress(), [newDepositedLPBeans, 0, amount, 0], minAmountOut);
        // Increment underlying balances of Unripe Tokens
        LibUnripe.incrementUnderlying(C.unripeBeanAddress(), newDepositedBeans);
        LibUnripe.incrementUnderlying(C.unripeLPAddress(), newLP);

        s.recapitalized = s.recapitalized.add(amount);
    }

    function push(uint32 id) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.fFirst == 0) {
            // Queue is empty
            s.season.fertilizing = true;
            s.fLast = id;
            s.fFirst = id;
        } else if (id <= s.fFirst) {
            // Add to front of queue
            setNext(id, s.fFirst);
            s.fFirst = id;
        } else if (id >= s.fLast) {
            // Add to back of queue
            setNext(s.fLast, id);
            s.fLast = id;
        } else {
            // Add to middle of queue
            uint32 prev = s.fFirst;
            uint32 next = getNext(prev);
            // Search for proper place in line
            while (id > next) {
                prev = next;
                next = getNext(next);
            }
            setNext(prev, id);
            setNext(id, next);
        }
    }

    function remainingRecapitalization() internal view returns (uint256 remaining) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalDollars = C.dollarPerUnripeLP().mul(C.unripeLP().totalSupply()).div(DECIMALS);
        if (s.recapitalized >= totalDollars) return 0;
        return totalDollars.sub(s.recapitalized);
    }

    function pop() internal returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint32 first = s.fFirst;
        s.activeFertilizer = s.activeFertilizer.sub(getAmount(first));
        uint32 next = getNext(first);
        if (next == 0) {
            // If all Unfertilized Beans have been fertilized, delete line.
            require(s.activeFertilizer == 0, "Still active fertliizer");
            s.fFirst = 0;
            s.fLast = 0;
            s.season.fertilizing = false;
            return false;
        }
        s.fFirst = getNext(first);
        return true;
    }

    function getAmount(uint32 id) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.fertilizer[id];
    }

    function getNext(uint32 id) internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint32 i = id/8;
        uint32 j = id-(i*8);
        return s.nextFid[i][j];
    }
    
    function setNext(uint32 id, uint32 next) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint32 i = id/8;
        uint32 j = id-(i*8);
        s.nextFid[i][j] = next;
    }

}
