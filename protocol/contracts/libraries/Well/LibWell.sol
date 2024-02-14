/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";
import {AppStorage, LibAppStorage, Storage} from "../LibAppStorage.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";

/**
 * @title Well Library
 * Contains helper functions for common Well related functionality.
 **/
library LibWell {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    // The BDV Selector that all Wells should be whitelisted with.
    bytes4 internal constant WELL_BDV_SELECTOR = 0xc84c7727;

    function getRatiosAndBeanIndex(IERC20[] memory tokens) internal view returns (
        uint[] memory ratios,
        uint beanIndex,
        bool success
    ) {
        return getRatiosAndBeanIndex(tokens, 0);
    }

    /**
     * @dev Returns the price ratios between `tokens` and the index of Bean in `tokens`.
     * These actions are combined into a single function for gas efficiency.
     */
    function getRatiosAndBeanIndex(IERC20[] memory tokens, uint256 lookback) internal view returns (
        uint[] memory ratios,
        uint beanIndex,
        bool success
    ) {
        success = true;
        ratios = new uint[](tokens.length);
        beanIndex = type(uint256).max;
        for (uint i; i < tokens.length; ++i) {
            if (C.BEAN == address(tokens[i])) {
                beanIndex = i;
                ratios[i] = 1e6;
            } else {
                ratios[i] = LibUsdOracle.getUsdPrice(address(tokens[i]), lookback);
                if (ratios[i] == 0) {
                    success = false;
                }
            }
        }
        require(beanIndex != type(uint256).max, "Bean not in Well.");
    }

    /**
     * @dev Returns the index of Bean in a list of tokens.
     */
    function getBeanIndex(IERC20[] memory tokens) internal pure returns (uint beanIndex) {
        for (beanIndex; beanIndex < tokens.length; ++beanIndex) {
            if (C.BEAN == address(tokens[beanIndex])) {
                return beanIndex;
            }
        }
        revert("Bean not in Well.");
    }

    /**
     * @dev Returns the index of Bean given a Well.
     */
    function getBeanIndexFromWell(address well) internal view returns (uint beanIndex) {
        IERC20[] memory tokens = IWell(well).tokens();
        beanIndex = getBeanIndex(tokens);
    }

    /**
     * @dev Returns the non-Bean token within a Well.
     * Assumes a well with 2 tokens only, with Bean being one of them.
     * Cannot fail (and thus revert), as wells cannot have 2 of the same tokens as the pairing.
     */
    function getNonBeanTokenAndIndexFromWell(
        address well
    ) internal view returns (address, uint256) {
        IERC20[] memory tokens = IWell(well).tokens();
        for (uint256 i; i < tokens.length; i++) {
            if (address(tokens[i]) != C.BEAN) {
                return (address(tokens[i]), i);
            }
        }
    }

    /**
     * @dev Returns whether an address is a whitelisted Well by checking
     * if the BDV function selector is the `wellBdv` function.
     */
    function isWell(address well) internal view returns (bool _isWell) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.ss[well].selector == WELL_BDV_SELECTOR;
    }

    /**
     * @notice gets the non-bean usd liquidity of a well,
     * using the twa reserves and price in storage.
     *
     * @dev this is done for gas efficency purposes, rather than calling the pump multiple times.
     * This function should be called after the reserves for the well have been set.
     * Currently this is only done in {seasonFacet.sunrise}.
     *
     * if LibWell.getUsdTokenPriceForWell() returns 1, then this function is called without the reserves being set.
     * if s.usdTokenPrice[well] or s.twaReserves[well] returns 0, then the oracle failed to compute
     * a valid price this Season, and thus beanstalk cannot calculate the usd liquidity.
     */
    function getWellTwaUsdLiquidityFromReserves(
        address well,
        uint256[] memory twaReserves
    ) internal view returns (uint256 usdLiquidity) {
        uint256 tokenUsd = getUsdTokenPriceForWell(well);
        (address token, uint256 j) = getNonBeanTokenAndIndexFromWell(well);
        if (tokenUsd > 1) {
            return twaReserves[j].mul(1e18).div(tokenUsd);
        }

        // if tokenUsd == 0, then the beanstalk could not compute a valid eth price,
        // and should return 0. if s.twaReserves[C.BEAN_ETH_WELL].reserve1 is 0, the previous if block will return 0.
        if (tokenUsd == 0) {
            return 0;
        }

        // if the function reaches here, then this is called outside the sunrise function
        // (i.e, seasonGetterFacet.getLiquidityToSupplyRatio()).We use LibUsdOracle
        // to get the price. This should never be reached during sunrise and thus
        // should not impact gas.
        return LibUsdOracle.getTokenPrice(token).mul(twaReserves[j]).div(1e6);
    }

    /**
     * @dev Sets the price in {AppStorage.usdTokenPrice} given a set of ratios.
     * It assumes that the ratios correspond to the Constant Product Well indexes.
     */
    function setUsdTokenPriceForWell(address well, uint256[] memory ratios) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // If the reserves length is 0, then {LibWellMinting} failed to compute
        // valid manipulation resistant reserves and thus the price is set to 0
        // indicating that the oracle failed to compute a valid price this Season.
        if (ratios.length == 0) {
            s.usdTokenPrice[well] = 0;
        } else {
            (, uint256 j) = getNonBeanTokenAndIndexFromWell(well);
            s.usdTokenPrice[well] = ratios[j];
        }
    }

    /**
     * @notice Returns the USD / TKN price stored in {AppStorage.usdTokenPrice}.
     * @dev assumes TKN has 18 decimals.
     */
    function getUsdTokenPriceForWell(address well) internal view returns (uint tokenUsd) {
        tokenUsd = LibAppStorage.diamondStorage().usdTokenPrice[well];
    }

    /**
     * @notice resets token price for a well to 1.
     * @dev must be called at the end of sunrise() once the
     * price is not needed anymore to save gas.
     */
    function resetUsdTokenPriceForWell(address well) internal {
        LibAppStorage.diamondStorage().usdTokenPrice[well] = 1;
    }

    /**
     * @dev Sets the twaReserves in {AppStorage.usdTokenPrice}.
     * assumes the twaReserve indexes correspond to the Constant Product Well indexes.
     * if the length of the twaReserves is 0, then the minting oracle is off.
     *
     */
    function setTwaReservesForWell(address well, uint256[] memory twaReserves) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // if the length of twaReserves is 0, then return 0.
        // the length of twaReserves should never be 1, but
        // is added to prevent revert.
        if (twaReserves.length <= 1) {
            delete s.twaReserves[well].reserve0;
            delete s.twaReserves[well].reserve1;
        } else {
            // safeCast not needed as the reserves are uint128 in the wells.
            s.twaReserves[well].reserve0 = uint128(twaReserves[0]);
            s.twaReserves[well].reserve1 = uint128(twaReserves[1]);
        }
    }

    /**
     * @notice Returns the TKN / USD price stored in {AppStorage.usdTokenPrice}.
     * @dev assumes TKN has 18 decimals.
     */
    function getTwaReservesForWell(
        address well
    ) internal view returns (uint256[] memory twaReserves) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        twaReserves = new uint256[](2);
        twaReserves[0] = s.twaReserves[well].reserve0;
        twaReserves[1] = s.twaReserves[well].reserve1;
    }

    /**
     * @notice resets token price for a well to 1.
     * @dev must be called at the end of sunrise() once the
     * price is not needed anymore to save gas.
     */
    function resetTwaReservesForWell(address well) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.twaReserves[well].reserve0 = 1;
        s.twaReserves[well].reserve1 = 1;
    }

    function getWellPriceFromTwaReserves(address well) internal view returns (uint256 price) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // s.twaReserve[well] should be set prior to this function being called.
        // 'price' is in terms of reserve0:reserve1.
        if (s.twaReserves[well].reserve0 == 0 || s.twaReserves[well].reserve1 == 0) {
            price = 0;
        } else {
            price = s.twaReserves[well].reserve0.mul(1e18).div(s.twaReserves[well].reserve1);
        }
    }

    function getTwaReservesFromStorageOrBeanstalkPump(
        address well
    ) internal view returns (uint256[] memory twaReserves) {
        twaReserves = getTwaReservesForWell(well);
        if (twaReserves[0] == 1) {
            twaReserves = getTwaReservesFromBeanstalkPump(well);
        }
    }

    /**
     * @notice gets the TwaReserves of a given well.
     * @dev only supports wells that are whitelisted in beanstalk.
     * the inital timestamp and reserves is the timestamp of the start
     * of the last season. wrapped in try/catch to return gracefully.
     */
    function getTwaReservesFromBeanstalkPump(
        address well
    ) internal view returns (uint256[] memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        try ICumulativePump(C.BEANSTALK_PUMP).readTwaReserves(
            well,
            s.wellOracleSnapshots[well],
            uint40(s.season.timestamp),
            C.BYTES_ZERO
        ) returns (uint[] memory twaReserves, bytes memory) {
            return twaReserves;
        } catch {
            return (new uint256[](2));
        }
    }

    /**
     * @notice gets the TwaLiquidity of a given well.
     * @dev only supports wells that are whitelisted in beanstalk.
     * the inital timestamp and reserves is the timestamp of the start
     * of the last season.
     */
    function getTwaLiquidityFromBeanstalkPump(
        address well,
        uint256 tokenUsdPrice
    ) internal view returns (uint256 usdLiquidity) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (, uint256 j) = getNonBeanTokenAndIndexFromWell(well);
        try ICumulativePump(C.BEANSTALK_PUMP).readTwaReserves(
            well,
            s.wellOracleSnapshots[well],
            uint40(s.season.timestamp),
            C.BYTES_ZERO
        ) returns (uint[] memory twaReserves, bytes memory) {
            usdLiquidity = tokenUsdPrice.mul(twaReserves[j]).div(1e6);
        } catch {
            // if pump fails to return a value, return 0.
            usdLiquidity = 0;
        }
    }
}
