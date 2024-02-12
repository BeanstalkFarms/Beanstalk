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
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {ILiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";
import {IGaugePointFacet} from "contracts/beanstalk/sun/GaugePointFacet.sol";

/**
 * Initializes the Migration of the Unripe LP underlying tokens from Bean:Eth to Bean:Steth.
 */
contract InitMigrateUnripeBeanEthToBeanSteth {
    using SafeERC20 for IERC20;
    using LibSafeMath32 for uint32;

    // gauge point factor is used to scale up the gauge points of the bean and bean3crv pools.
    uint128 internal constant BEAN_WSTETH_INITIAL_GAUGE_POINTS = 1000e18;

    uint32 constant BEAN_ETH_PUMP_CATCH_UP_SEASONS = 24;
    uint32 constant private STALK_ISSUED_PER_BDV = 10000;
    uint64 constant private OPTIMAL_PERCENT_DEPOSITED_BDV = 5e6;
    uint64 constant private MAX_PERCENT_DEPOSITED_BDV = 100e6;

    AppStorage internal s;

    function init() external {

        // Turn off Bean:Eth Minting while Multi Flow Pump catches up
        delete s.wellOracleSnapshots[C.BEAN_ETH_WELL];
        s.season.beanEthStartMintingSeason = s.season.current + BEAN_ETH_PUMP_CATCH_UP_SEASONS;

        LibWhitelist.whitelistToken(
            C.BEAN_WSTETH_WELL,
            BDVFacet.wellBdv.selector,
            STALK_ISSUED_PER_BDV,
            0, // No need to set Stalk issued per BDV
            0x01,
            IGaugePointFacet.defaultGaugePointFunction.selector,
            ILiquidityWeightFacet.maxWeight.selector,
            BEAN_WSTETH_INITIAL_GAUGE_POINTS,
            OPTIMAL_PERCENT_DEPOSITED_BDV
        );

        LibWhitelist.updateOptimalPercentDepositedBdvForToken(
            C.BEAN_ETH_WELL,
            MAX_PERCENT_DEPOSITED_BDV - OPTIMAL_PERCENT_DEPOSITED_BDV
        );

        // Migrate to BEAN_STETH;
        uint256 balanceOfUnderlying = s.u[C.UNRIPE_LP].balanceOfUnderlying;
        IERC20(s.u[C.UNRIPE_LP].underlyingToken).safeTransfer(
            LibDiamond.diamondStorage().contractOwner,
            balanceOfUnderlying
        );
        LibUnripe.decrementUnderlying(C.UNRIPE_LP, balanceOfUnderlying);
        LibUnripe.switchUnderlyingToken(C.UNRIPE_LP, C.BEAN_WSTETH_WELL);

        s.barnRaiseWell = C.BEAN_WSTETH_WELL;
    }
}