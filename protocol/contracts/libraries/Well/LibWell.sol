/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {IWellFunction} from "contracts/interfaces/basin/IWellFunction.sol";
import {C} from "contracts/C.sol";
import {AppStorage, LibAppStorage} from "../LibAppStorage.sol";
import {LibUsdOracle, LibEthUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";

/**
 * @title Well Library
 * Contains helper functions for common Well related functionality.
 **/
library LibWell {
    using SafeMath for uint256;

    uint256 private constant PRECISION = 1e30;

    /**
     * @dev Returns the price ratios between `tokens` and the index of Bean in `tokens`.
     * These actions are combined into a single function for gas efficiency.
     */
    function getRatiosAndBeanIndex(
        IERC20[] memory tokens
    ) internal view returns (uint[] memory ratios, uint beanIndex, bool success) {
        success = true;
        ratios = new uint[](tokens.length);
        beanIndex = type(uint256).max;
        for (uint i; i < tokens.length; ++i) {
            if (C.BEAN == address(tokens[i])) {
                beanIndex = i;
                ratios[i] = 1e6;
            } else {
                ratios[i] = LibUsdOracle.getUsdPrice(address(tokens[i]));
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
     * Assumes a well with 2 tokens only.
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
        return s.ss[well].selector == 0xc84c7727;
    }

    /**
     * @notice gets the liquidity of a well in USD
     * precision is in the decimals of the non_bean asset in the well.
     * assumes a well that:
     * 1) has attached the Beanstalk pump.
     * 2) has 2 tokens.
     *
     * @dev if the token is WETH and in the sunrise function,
     *  we use the value stored in s.usdEthPrice to get the price of eth in usd.
     *  we use the twaReserves stored in s.ethReserve to get the amount of eth in the pool.
     *  if s.usdEthPrice is 1 or 0, then this function is called outside of sunrise.
     *  if s.usdEthPrice or s.ethReserve/s.beanReserve is 0, then the oracle failed to compute
     *  a valid price this Season, and thus beanstalk cannot calculate the usd liquidity
     *  (and will return 0).
     */
    function getUsdLiquidity(address well) internal view returns (uint256 usdLiquidity) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // get the non-bean address and index
        (address token, uint256 j) = getNonBeanTokenAndIndexFromWell(well);
        if (token == C.WETH) {
            uint256 ethUsd = LibEthUsdOracle.getUsdEthPrice();
            if (ethUsd > 1) {
                uint256 price = uint256(1e24).div(ethUsd);
                return price.mul(s.ethReserve).div(1e6);
            }
        }
        // if the non-bean asset of the well is not WETH,
        // or if the usd oracle returns 1/0,
        // get the liquidity with the pump instead.
        return getUsdLiquidityWithPump(well, token, j);
    }

    /**
     * @notice gets the usd value of a well, using the emaReserves from the pumps.
     */
    function getUsdLiquidityWithPump(
        address well,
        address token,
        uint256 index
    ) internal view returns (uint256 usdLiquidity) {
        uint256[] memory twaReserves = getTwaReservesFromBeanstalkPump(well);
        uint256 price = LibUsdOracle.getTokenPrice(token);
        usdLiquidity = price.mul(twaReserves[index]).div(1e6);
    }

    /**
     * @notice gets the TwaReserves of a given well. 
     * @dev only supports wells that are whitelisted in beanstalk.
     * the inital timestamp and reserves is the timestamp of the start
     * of the last season.
     */
    function getTwaReservesFromBeanstalkPump(address well) internal view returns (uint256[] memory twaReserves) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (twaReserves, ) = ICumulativePump(C.BEANSTALK_PUMP).readTwaReserves(
            well,
            s.wellOracleSnapshots[well],
            s.season.timestamp,
            C.BYTES_ZERO
        );
    }
}
