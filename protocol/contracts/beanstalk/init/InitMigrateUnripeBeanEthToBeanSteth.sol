/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {C} from "contracts/C.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {ILiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";
import {IGaugePointFacet} from "contracts/beanstalk/sun/GaugePointFacet.sol";

/**
 * Initializes the Migration of the Unripe LP underlying tokens from Bean:Eth to Bean:Steth.
 * It:
 * - Turns off Bean:Eth Minting while Multi Flow Pump catches up
 * - Whitelists Bean:WstETH
 * - Updates the optimal percent deposited for Bean:Eth
 * - Migrates the Unripe LP underlying tokens from Bean:Eth to Bean:Wsteth
 */
contract InitMigrateUnripeBeanEthToBeanSteth {

    // The initial gauge points for Bean:WstETH.
    uint128 internal constant BEAN_WSTETH_INITIAL_GAUGE_POINTS = 100e18;

    // The amount of Seasons that Bean:Eth Minting will be off.
    uint32 constant BEAN_ETH_PUMP_CATCH_UP_SEASONS = 24;

    // The initial Stalk issued per BDV for all whitelisted Silo tokens.
    uint32 constant private STALK_ISSUED_PER_BDV = 10000;

    // The optimal percent deposited for Bean:Wsteth.
    uint64 constant private OPTIMAL_PERCENT_DEPOSITED_BDV = 5e6;

    // The total percent deposited BDV.
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

        LibFertilizer.switchBarnRaiseWell(C.BEAN_WSTETH_WELL);

    }
}