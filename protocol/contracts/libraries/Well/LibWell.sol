/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWell, Call} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";
import {LibAppStorage} from "../LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibRedundantMath128} from "contracts/libraries/LibRedundantMath128.sol";
import {IMultiFlowPumpWellFunction} from "contracts/interfaces/basin/pumps/IMultiFlowPumpWellFunction.sol";
import {IBeanstalkWellFunction} from "contracts/interfaces/basin/IBeanstalkWellFunction.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/**
 * @title Well Library
 * Contains helper functions for common Well related functionality.
 **/
library LibWell {
    using LibRedundantMath256 for uint256;
    using LibRedundantMath128 for uint128;

    // The BDV Selector that all Wells should be whitelisted with.
    bytes4 internal constant WELL_BDV_SELECTOR = 0xc84c7727;

    uint256 private constant BEAN_UNIT = 1e6;

    function getRatiosAndBeanIndex(
        IERC20[] memory tokens
    ) internal view returns (uint[] memory ratios, uint beanIndex, bool success) {
        return getRatiosAndBeanIndex(tokens, 0);
    }

    /**
     * @dev Returns the price ratios between `tokens` and the index of Bean in `tokens`.
     * These actions are combined into a single function for gas efficiency.
     */
    function getRatiosAndBeanIndex(
        IERC20[] memory tokens,
        uint256 lookback
    ) internal view returns (uint[] memory ratios, uint beanIndex, bool success) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        success = true;
        ratios = new uint[](tokens.length);
        beanIndex = type(uint256).max;
        bool isMillion;
        address bean = s.sys.tokens.bean;

        // fetch the bean index and check whether the ratios precision needs to be increased.
        for (uint i; i < tokens.length; ++i) {
            if (address(tokens[i]) == bean) {
                beanIndex = i;
            } else if (IERC20Decimals(address(tokens[i])).decimals() < 8) {
                // if the nonBean token in the well has a low decimal precision,
                // set `isMillion` such that the ratio is set to be on a million basis.
                isMillion = true;
            }
        }

        // get the target ratios.
        for (uint i; i < tokens.length; ++i) {
            if (address(tokens[i]) == bean) {
                if (isMillion) {
                    ratios[i] = 1e12;
                } else {
                    ratios[i] = 1e6;
                }
            } else {
                if (isMillion) {
                    ratios[i] = LibUsdOracle.getMillionUsdPrice(address(tokens[i]), lookback);
                } else {
                    ratios[i] = LibUsdOracle.getUsdPrice(address(tokens[i]), lookback);
                }
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
    function getBeanIndex(IERC20[] memory tokens) internal view returns (uint beanIndex) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (beanIndex; beanIndex < tokens.length; ++beanIndex) {
            if (s.sys.tokens.bean == address(tokens[beanIndex])) {
                return beanIndex;
            }
        }
        revert("Bean not in Well.");
    }

    /**
     * @dev Returns the first ERC20 well token that is not Bean.
     */
    function getNonBeanIndex(IERC20[] memory tokens) internal view returns (uint nonBeanIndex) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        for (nonBeanIndex; nonBeanIndex < tokens.length; ++nonBeanIndex) {
            if (s.sys.tokens.bean != address(tokens[nonBeanIndex])) {
                return nonBeanIndex;
            }
        }
        revert("Non-Bean not in Well.");
    }

    /**
     * @dev Returns the index of Bean given a Well.
     */
    function getBeanIndexFromWell(address well) internal view returns (uint beanIndex) {
        IERC20[] memory tokens = IWell(well).tokens();
        beanIndex = getBeanIndex(tokens);
    }

    function getNonBeanTokenFromWell(address well) internal view returns (IERC20 nonBeanToken) {
        IERC20[] memory tokens = IWell(well).tokens();
        return tokens[getNonBeanIndex(tokens)];
    }

    /**
     * @dev Returns the non-Bean token within a Well.
     * Assumes a well with 2 tokens only, with Bean being one of them.
     * Cannot fail (and thus revert), as wells cannot have 2 of the same tokens as the pairing.
     */
    function getNonBeanTokenAndIndexFromWell(
        address well
    ) internal view returns (address, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        IERC20[] memory tokens = IWell(well).tokens();
        for (uint256 i; i < tokens.length; i++) {
            if (address(tokens[i]) != s.sys.tokens.bean) {
                return (address(tokens[i]), i);
            }
        }
        revert("LibWell: invalid well:");
    }

    /**
     * @dev Returns whether an address is a whitelisted Well by checking
     * if the BDV function selector is the `wellBdv` function.
     */
    function isWell(address well) internal view returns (bool _isWell) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.sys.silo.assetSettings[well].selector == WELL_BDV_SELECTOR;
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
     * if s.sys.usdTokenPrice[well] or s.sys.twaReserves[well] returns 0, then the oracle failed to compute
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
        // and should return 0. if s.sys.twaReserves[well].reserve1 is 0, the previous if block will return 0.
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
     * Assumes
     * 1) Ratios correspond to the Constant Product Well indexes.
     * 2) the Well is a 2 token Well.
     */
    function setUsdTokenPriceForWell(address well, uint256[] memory ratios) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // If the reserves length is 0, then {LibWellMinting} failed to compute
        // valid manipulation resistant reserves and thus the price is set to 0
        // indicating that the oracle failed to compute a valid price this Season.
        if (ratios.length == 0) {
            s.sys.usdTokenPrice[well] = 0;
        } else {
            (, uint256 j) = getNonBeanTokenAndIndexFromWell(well);
            uint256 i = j == 0 ? 1 : 0;
            // usdTokenPrice is scaled down to USD/TOKEN, in the cases where
            // Beanstalk calculated the MILLION_USD/TOKEN price instead of USD/TOKEN price.
            // Beanstalk accepts the loss of precision here, as `usdTokenPrice[well]` is used for
            // calculating the liquidity and excessive price.
            s.sys.usdTokenPrice[well] = (ratios[j] * 1e6) / ratios[i];
        }
    }

    /**
     * @notice Returns the USD / TKN price stored in {AppStorage.usdTokenPrice}.
     * @dev assumes TKN has 18 decimals.
     */
    function getUsdTokenPriceForWell(address well) internal view returns (uint tokenUsd) {
        tokenUsd = LibAppStorage.diamondStorage().sys.usdTokenPrice[well];
    }

    /**
     * @notice resets token price for a well to 1.
     * @dev must be called at the end of sunrise() once the
     * price is not needed anymore to save gas.
     */
    function resetUsdTokenPriceForWell(address well) internal {
        LibAppStorage.diamondStorage().sys.usdTokenPrice[well] = 1;
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
            delete s.sys.twaReserves[well].reserve0;
            delete s.sys.twaReserves[well].reserve1;
        } else {
            // safeCast not needed as the reserves are uint128 in the wells.
            s.sys.twaReserves[well].reserve0 = uint128(twaReserves[0]);
            s.sys.twaReserves[well].reserve1 = uint128(twaReserves[1]);
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
        twaReserves[0] = s.sys.twaReserves[well].reserve0;
        twaReserves[1] = s.sys.twaReserves[well].reserve1;
    }

    /**
     * @notice resets token price for a well to 1.
     * @dev must be called at the end of sunrise() once the
     * price is not needed anymore to save gas.
     */
    function resetTwaReservesForWell(address well) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.twaReserves[well].reserve0 = 1;
        s.sys.twaReserves[well].reserve1 = 1;
    }

    /**
     * @notice returns the price in terms of TKN/BEAN.
     * (if eth is 1000 beans, this function will return 1000e6);
     */
    function getTokenBeanPriceFromTwaReserves(address well) internal view returns (uint256 price) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // s.sys.twaReserve[well] should be set prior to this function being called.
        // 'price' is in terms of reserve0:reserve1.
        if (s.sys.twaReserves[well].reserve0 == 0 || s.sys.twaReserves[well].reserve1 == 0) {
            price = 0;
        } else {
            // fetch the bean index from the well in order to properly return the bean price.
            uint256[] memory reserves = new uint256[](2);
            reserves[0] = s.sys.twaReserves[well].reserve0;
            reserves[1] = s.sys.twaReserves[well].reserve1;

            Call memory wellFunction = IWell(well).wellFunction();

            if (getBeanIndexFromWell(well) == 0) {
                price = calculateTokenBeanPriceFromReserves(well, 0, 1, reserves, wellFunction);
            } else {
                price = calculateTokenBeanPriceFromReserves(well, 1, 0, reserves, wellFunction);
            }
        }
    }

    function calculateTokenBeanPriceFromReserves(
        address well,
        uint256 beanIndex,
        uint256 nonBeanIndex,
        uint256[] memory reserves,
        Call memory wellFunction
    ) internal view returns (uint256 price) {
        address nonBeanToken = address(IWell(well).tokens()[nonBeanIndex]);
        uint256 lpTokenSupply = IBeanstalkWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        );

        uint256 oldReserve = reserves[nonBeanIndex];
        reserves[beanIndex] = reserves[beanIndex] + BEAN_UNIT;
        uint256 newReserve = IBeanstalkWellFunction(wellFunction.target).calcReserve(
            reserves,
            nonBeanIndex,
            lpTokenSupply,
            wellFunction.data
        );
        uint256 delta;
        if (nonBeanIndex == 1) {
            delta = oldReserve - newReserve;
        } else {
            delta = newReserve - oldReserve;
        }
        price = (10 ** (IERC20Decimals(nonBeanToken).decimals() + 6)) / delta;
    }

    function getTwaReservesFromStorageOrBeanstalkPump(
        address well
    ) internal view returns (uint256[] memory twaReserves) {
        twaReserves = getTwaReservesForWell(well);
        if (twaReserves[0] == 1) {
            twaReserves = getTwaReservesFromPump(well);
        }
    }

    /**
     * @notice gets the TwaReserves of a given well.
     * @dev only supports wells that are whitelisted in beanstalk.
     * the initial timestamp and reserves is the timestamp of the start
     * of the last season. wrapped in try/catch to return gracefully.
     */
    function getTwaReservesFromPump(address well) internal view returns (uint256[] memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Call[] memory pumps = IWell(well).pumps();
        try
            ICumulativePump(pumps[0].target).readTwaReserves(
                well,
                s.sys.wellOracleSnapshots[well],
                uint40(s.sys.season.timestamp),
                pumps[0].data
            )
        returns (uint[] memory twaReserves, bytes memory) {
            return twaReserves;
        } catch {
            return (new uint256[](2));
        }
    }

    /**
     * @notice returns the twa reserves for well,
     * given the cumulative reserves and timestamp.
     * @dev wrapped in a try/catch to return gracefully.
     */
    function getTwaReservesFromPump(
        address well,
        bytes memory cumulativeReserves,
        uint40 timestamp
    ) internal view returns (uint256[] memory) {
        Call[] memory pump = IWell(well).pumps();
        try
            ICumulativePump(pump[0].target).readTwaReserves(
                well,
                cumulativeReserves,
                timestamp,
                pump[0].data
            )
        returns (uint[] memory twaReserves, bytes memory) {
            return twaReserves;
        } catch {
            return (new uint256[](2));
        }
    }

    /**
     * @notice gets the TwaLiquidity of a given well.
     * @dev only supports wells that are whitelisted in beanstalk.
     * the initial timestamp and reserves is the timestamp of the start
     * of the last season.
     */
    function getTwaLiquidityFromPump(
        address well,
        uint256 tokenUsdPrice
    ) internal view returns (uint256 usdLiquidity) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (, uint256 j) = getNonBeanTokenAndIndexFromWell(well);
        Call[] memory pumps = IWell(well).pumps();
        try
            ICumulativePump(pumps[0].target).readTwaReserves(
                well,
                s.sys.wellOracleSnapshots[well],
                uint40(s.sys.season.timestamp),
                pumps[0].data
            )
        returns (uint[] memory twaReserves, bytes memory) {
            usdLiquidity = tokenUsdPrice.mul(twaReserves[j]).div(1e6);
        } catch {
            // if pump fails to return a value, return 0.
            usdLiquidity = 0;
        }
    }
}
