/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {C} from "contracts/C.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";

// NOTE: Values are arbitrary placeholders. Need to be populated with correct values at a snapshot point.

/**
 * @author funderbrker
 * @notice Initializes the new storage variables underlying invariants.
 */
contract InitInvariants {
    AppStorage internal s;

    function init() external {
        setInternalTokenBalances();

        // TODO: Get exact from future snapshot.
        s.sys.fert.fertilizedPaidIndex = 3_500_000_000_000;

        // TODO: migrate old unclaimed plenty to here? or auto-claim plenty if there's any left unclaimed?
        s.sys.sop.plentyPerSopToken[C.WETH] = 0;
    }

    function setInternalTokenBalances() internal {
        // TODO: Deconstruct s.sys.internalTokenBalance offchain and set all tokens and all totals here.
        s.sys.internalTokenBalanceTotal[IERC20(C.BEAN)] = 115611612399;
        s.sys.internalTokenBalanceTotal[IERC20(C.BEAN_ETH_WELL)] = 0;
        s.sys.internalTokenBalanceTotal[IERC20(C.UNRIPE_BEAN)] = 9001888;
        s.sys.internalTokenBalanceTotal[IERC20(C.UNRIPE_LP)] = 12672419462;
    }
}
