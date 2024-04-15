/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {C} from "contracts/C.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";

/**
 * Initializes the Migration of the Unripe LP underlying tokens from Bean:3Crv to Bean:Eth.
 */
contract InitInvariants {
    AppStorage internal s;

    function init(uint256 _fertilizerPaidIndex) external {
        // TODO: Test this numbers at a specific season when they are all carefully and correctly sourced.

        /* 
        TODO: Get exacts from future snapshot.
        NOTE: Approximate. Sourced from subgraph using
        {siloAssetHourlySnapshots(orderBy: season, orderDirection:desc, first: 6, where: {season: 20824, siloAsset_contains_nocase: "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5" }
            ) { 
                siloAsset{
                token
                }
                season
                depositedAmount
                withdrawnAmount
                farmAmount
            }
        }
        */
        s.internalTokenBalanceTotal[IERC20(C.BEAN)] = 115611612399;
        s.internalTokenBalanceTotal[IERC20(C.BEAN_ETH_WELL)] = 0; // ?????
        s.internalTokenBalanceTotal[IERC20(C.CURVE_BEAN_METAPOOL)] = 9238364833184139286;
        s.internalTokenBalanceTotal[IERC20(C.UNRIPE_BEAN)] = 9001888;
        s.internalTokenBalanceTotal[IERC20(C.UNRIPE_LP)] = 12672419462;

        // TODO: Get exact from future snapshot.
        // NOTE: Approximate. Sourced from subgraph.
        s.fertilizedPaidIndex = _fertilizerPaidIndex; // 3_500_000_000_000;
    }
}
