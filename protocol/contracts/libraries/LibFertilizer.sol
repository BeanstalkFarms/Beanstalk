/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";
import {LibSafeMath128} from "./LibSafeMath128.sol";
import {C} from "../C.sol";
import {LibUnripe} from "./LibUnripe.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibBarnRaise} from "./LibBarnRaise.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";

/**
 * @author Publius
 * @title Fertilizer
 **/

library LibFertilizer {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;
    using SafeCast for uint256;
    using SafeERC20 for IERC20;
    using LibWell for address;

    event SetFertilizer(uint128 id, uint128 bpf);

    // 6 - 3
    uint128 private constant PADDING = 1e3;
    uint128 private constant DECIMALS = 1e6;
    uint128 private constant REPLANT_SEASON = 6074;
    uint128 private constant RESTART_HUMIDITY = 2500;
    uint128 private constant END_DECREASE_SEASON = REPLANT_SEASON + 461;

    function addFertilizer(
        uint128 season,
        uint256 tokenAmountIn,
        uint256 fertilizerAmount,
        uint256 minLP
    ) internal returns (uint128 id) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint128 fertilizerAmount128 = fertilizerAmount.toUint128();

        // Calculate Beans Per Fertilizer and add to total owed
        uint128 bpf = getBpf(season);
        s.unfertilizedIndex = s.unfertilizedIndex.add(
            fertilizerAmount.mul(bpf)
        );
        // Get id
        id = s.bpf.add(bpf);
        // Update Total and Season supply
        s.fertilizer[id] = s.fertilizer[id].add(fertilizerAmount128);
        s.activeFertilizer = s.activeFertilizer.add(fertilizerAmount);
        // Add underlying to Unripe Beans and Unripe LP
        addUnderlying(tokenAmountIn, fertilizerAmount.mul(DECIMALS), minLP);
        // If not first time adding Fertilizer with this id, return
        if (s.fertilizer[id] > fertilizerAmount128) return id;
        // If first time, log end Beans Per Fertilizer and add to Season queue.
        push(id);
        emit SetFertilizer(id, bpf);
    }

    function getBpf(uint128 id) internal pure returns (uint128 bpf) {
        bpf = getHumidity(id).add(1000).mul(PADDING);
    }

    function getHumidity(uint128 id) internal pure returns (uint128 humidity) {
        if (id == 0) return 5000;
        if (id >= END_DECREASE_SEASON) return 200;
        uint128 humidityDecrease = id.sub(REPLANT_SEASON).mul(5);
        humidity = RESTART_HUMIDITY.sub(humidityDecrease);
    }

    /**
     * @dev Any token contributions should already be transferred to the Barn Raise Well to allow for a gas efficient liquidity
     * addition through the use of `sync`. See {FertilizerFacet.mintFertilizer} for an example.
     */
    function addUnderlying(uint256 tokenAmountIn, uint256 usdAmount, uint256 minAmountOut) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Calculate how many new Deposited Beans will be minted
        uint256 percentToFill = usdAmount.mul(C.precision()).div(
            remainingRecapitalization()
        );

        uint256 newDepositedBeans;
        if (C.unripeBean().totalSupply() > s.u[C.UNRIPE_BEAN].balanceOfUnderlying) {
            newDepositedBeans = (C.unripeBean().totalSupply()).sub(
                s.u[C.UNRIPE_BEAN].balanceOfUnderlying
            );
            newDepositedBeans = newDepositedBeans.mul(percentToFill).div(
                C.precision()
            );
        }
        // Calculate how many Beans to add as LP
        uint256 newDepositedLPBeans = usdAmount.mul(C.exploitAddLPRatio()).div(
            DECIMALS
        );

        // Mint the Deposited Beans to Beanstalk.
        C.bean().mint(
            address(this),
            newDepositedBeans
        );

        // Mint the LP Beans and add liquidity to the well.
        address barnRaiseWell = LibBarnRaise.getBarnRaiseWell();
        address barnRaiseToken = LibBarnRaise.getBarnRaiseToken();

        C.bean().mint(
            address(this),
            newDepositedLPBeans
        );

        IERC20(barnRaiseToken).transferFrom(
            msg.sender,
            address(this),
            uint256(tokenAmountIn)
        );

        IERC20(barnRaiseToken).approve(barnRaiseWell, uint256(tokenAmountIn));
        C.bean().approve(barnRaiseWell, newDepositedLPBeans);

        uint256[] memory tokenAmountsIn = new uint256[](2);
        IERC20[] memory tokens = IWell(barnRaiseWell).tokens();
        (tokenAmountsIn[0], tokenAmountsIn[1]) = tokens[0] == C.bean() ?
            (newDepositedLPBeans, tokenAmountIn) :
            (tokenAmountIn, newDepositedLPBeans);

        uint256 newLP = IWell(barnRaiseWell).addLiquidity(
            tokenAmountsIn,
            minAmountOut,
            address(this),
            type(uint256).max
        );

        // Increment underlying balances of Unripe Tokens
        LibUnripe.incrementUnderlying(C.UNRIPE_BEAN, newDepositedBeans);
        LibUnripe.incrementUnderlying(C.UNRIPE_LP, newLP);

        s.recapitalized = s.recapitalized.add(usdAmount);
    }

    function push(uint128 id) internal {
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
            uint128 prev = s.fFirst;
            uint128 next = getNext(prev);
            // Search for proper place in line
            while (id > next) {
                prev = next;
                next = getNext(next);
            }
            setNext(prev, id);
            setNext(id, next);
        }
    }

    function remainingRecapitalization()
        internal
        view
        returns (uint256 remaining)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalDollars = C
            .dollarPerUnripeLP()
            .mul(C.unripeLP().totalSupply())
            .div(DECIMALS);
        totalDollars = totalDollars / 1e6 * 1e6; // round down to nearest USDC
        if (s.recapitalized >= totalDollars) return 0;
        return totalDollars.sub(s.recapitalized);
    }

    function pop() internal returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint128 first = s.fFirst;
        s.activeFertilizer = s.activeFertilizer.sub(getAmount(first));
        uint128 next = getNext(first);
        if (next == 0) {
            // If all Unfertilized Beans have been fertilized, delete line.
            require(s.activeFertilizer == 0, "Still active fertilizer");
            s.fFirst = 0;
            s.fLast = 0;
            s.season.fertilizing = false;
            return false;
        }
        s.fFirst = getNext(first);
        return true;
    }

    function getAmount(uint128 id) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.fertilizer[id];
    }

    function getNext(uint128 id) internal view returns (uint128) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.nextFid[id];
    }

    function setNext(uint128 id, uint128 next) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.nextFid[id] = next;
    }

    function beginBarnRaiseMigration(address well) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(well.isWell(), "Fertilizer: Not a Whitelisted Well.");

        // The Barn Raise only supports 2 token Wells where 1 token is Bean and the
        // other is supported by the Lib Usd Oracle.
        IERC20[] memory tokens = IWell(well).tokens();
        require(tokens.length == 2, "Fertilizer: Well must have 2 tokens.");
        require(
            tokens[0] == C.bean() || tokens[1] == C.bean(),
            "Fertilizer: Well must have BEAN."
        );
        // Check that Lib Usd Oracle supports the non-Bean token in the Well.
        LibUsdOracle.getTokenPrice(address(tokens[tokens[0] == C.bean() ? 1 : 0]));

        uint256 balanceOfUnderlying = s.u[C.UNRIPE_LP].balanceOfUnderlying;
        IERC20(s.u[C.UNRIPE_LP].underlyingToken).safeTransfer(
            LibDiamond.diamondStorage().contractOwner,
            balanceOfUnderlying
        );
        LibUnripe.decrementUnderlying(C.UNRIPE_LP, balanceOfUnderlying);
        LibUnripe.switchUnderlyingToken(C.UNRIPE_LP, well);
    }
}
