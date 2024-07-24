// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Decimal} from "contracts/libraries/Decimal.sol";
import {LibWhitelistedTokens, C} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibRedundantMath32} from "contracts/libraries/LibRedundantMath32.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";

/**
 * @author Brean
 * @title LibEvaluate calculates the caseId based on the state of Beanstalk.
 * @dev the current parameters that beanstalk uses to evaluate its state are:
 * - DeltaB, the amount of Beans needed to be bought/sold to reach peg.
 * - PodRate, the ratio of Pods outstanding against the bean supply.
 * - Delta Soil demand, the change in demand of Soil between the current and previous Season.
 * - LpToSupplyRatio (L2SR), the ratio of liquidity to the circulating Bean supply.
 *
 * based on the caseId, Beanstalk adjusts:
 * - the Temperature
 * - the ratio of the gaugePoints per BDV of bean and the largest GpPerBdv for a given LP token.
 */

library DecimalExtended {
    uint256 private constant PERCENT_BASE = 1e18;

    function toDecimal(uint256 a) internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: a});
    }
}

library LibEvaluate {
    using LibRedundantMath256 for uint256;
    using DecimalExtended for uint256;
    using Decimal for Decimal.D256;
    using LibRedundantMath32 for uint32;

    // Pod rate bounds
    // uint256 internal constant POD_RATE_LOWER_BOUND = 0.05e18; // 5%
    // uint256 internal constant POD_RATE_OPTIMAL = 0.15e18; // 15%
    // uint256 internal constant POD_RATE_UPPER_BOUND = 0.25e18; // 25%

    // Change in Soil demand bounds
    // uint256 internal constant DELTA_POD_DEMAND_LOWER_BOUND = 0.95e18; // 95%
    // uint256 internal constant DELTA_POD_DEMAND_UPPER_BOUND = 1.05e18; // 105%

    /// @dev If all Soil is Sown faster than this, Beanstalk considers demand for Soil to be increasing.
    uint256 internal constant SOW_TIME_DEMAND_INCR = 600; // seconds

    uint32 internal constant SOW_TIME_STEADY = 60; // seconds

    // Liquidity to supply ratio bounds
    // uint256 internal constant LP_TO_SUPPLY_RATIO_UPPER_BOUND = 0.8e18; // 80%
    // uint256 internal constant LP_TO_SUPPLY_RATIO_OPTIMAL = 0.4e18; // 40%
    // uint256 internal constant LP_TO_SUPPLY_RATIO_LOWER_BOUND = 0.12e18; // 12%

    // Excessive price threshold constant
    // uint256 internal constant EXCESSIVE_PRICE_THRESHOLD = 1.05e6;

    uint256 internal constant LIQUIDITY_PRECISION = 1e12;

    struct BeanstalkState {
        Decimal.D256 deltaPodDemand;
        Decimal.D256 lpToSupplyRatio;
        Decimal.D256 podRate;
        address largestLiqWell;
        bool oracleFailure;
    }

    /**
     * @notice evaluates the pod rate and returns the caseId
     * @param podRate the length of the podline (debt), divided by the bean supply.
     */
    function evalPodRate(Decimal.D256 memory podRate) internal view returns (uint256 caseId) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (podRate.greaterThanOrEqualTo(s.sys.seedGaugeSettings.podRateUpperBound.toDecimal())) {
            caseId = 27;
        } else if (
            podRate.greaterThanOrEqualTo(s.sys.seedGaugeSettings.podRateOptimal.toDecimal())
        ) {
            caseId = 18;
        } else if (
            podRate.greaterThanOrEqualTo(s.sys.seedGaugeSettings.podRateLowerBound.toDecimal())
        ) {
            caseId = 9;
        }
    }

    /**
     * @notice updates the caseId based on the price of bean (deltaB)
     * @param deltaB the amount of beans needed to be sold or bought to get bean to peg.
     * @param well the well address to get the bean price from.
     */
    function evalPrice(int256 deltaB, address well) internal view returns (uint256 caseId) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // p > 1
        if (deltaB > 0) {
            // Beanstalk will only use the largest liquidity well to compute the Bean price,
            // and thus will skip the p > EXCESSIVE_PRICE_THRESHOLD check if the well oracle fails to
            // compute a valid price this Season.
            // deltaB > 0 implies that address(well) != address(0).
            uint256 beanTknPrice = LibWell.getBeanTokenPriceFromTwaReserves(well);
            if (beanTknPrice > 1) {
                uint256 beanUsdPrice = uint256(1e30).div(
                    LibWell.getUsdTokenPriceForWell(well).mul(beanTknPrice)
                );
                if (beanUsdPrice > s.sys.seedGaugeSettings.excessivePriceThreshold) {
                    // p > excessivePriceThreshold
                    return caseId = 6;
                }
            }
            caseId = 3;
        }
        // p < 1
    }

    /**
     * @notice Updates the caseId based on the change in Soil demand.
     * @param deltaPodDemand The change in Soil demand from the previous Season.
     */
    function evalDeltaPodDemand(
        Decimal.D256 memory deltaPodDemand
    ) internal view returns (uint256 caseId) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // increasing
        if (
            deltaPodDemand.greaterThanOrEqualTo(
                s.sys.seedGaugeSettings.deltaPodDemandUpperBound.toDecimal()
            )
        ) {
            caseId = 2;
            // steady
        } else if (
            deltaPodDemand.greaterThanOrEqualTo(
                s.sys.seedGaugeSettings.deltaPodDemandLowerBound.toDecimal()
            )
        ) {
            caseId = 1;
        }
        // decreasing (caseId = 0)
    }

    /**
     * @notice Evaluates the lp to supply ratio and returns the caseId.
     * @param lpToSupplyRatio The ratio of liquidity to supply.
     *
     * @dev 'liquidity' is definied as the non-bean value in a pool that trades beans.
     */
    function evalLpToSupplyRatio(
        Decimal.D256 memory lpToSupplyRatio
    ) internal view returns (uint256 caseId) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Extremely High
        if (
            lpToSupplyRatio.greaterThanOrEqualTo(
                s.sys.seedGaugeSettings.lpToSupplyRatioUpperBound.toDecimal()
            )
        ) {
            caseId = 108;
            // Reasonably High
        } else if (
            lpToSupplyRatio.greaterThanOrEqualTo(
                s.sys.seedGaugeSettings.lpToSupplyRatioOptimal.toDecimal()
            )
        ) {
            caseId = 72;
            // Reasonably Low
        } else if (
            lpToSupplyRatio.greaterThanOrEqualTo(
                s.sys.seedGaugeSettings.lpToSupplyRatioLowerBound.toDecimal()
            )
        ) {
            caseId = 36;
        }
        // excessively low (caseId = 0)
    }

    /**
     * @notice Calculates the change in soil demand from the previous season.
     * @param dsoil The amount of soil sown this season.
     */
    function calcDeltaPodDemand(
        uint256 dsoil
    )
        internal
        view
        returns (Decimal.D256 memory deltaPodDemand, uint32 lastSowTime, uint32 thisSowTime)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // `s.weather.thisSowTime` is set to the number of seconds in it took for
        // Soil to sell out during the current Season. If Soil didn't sell out,
        // it remains `type(uint32).max`.
        if (s.sys.weather.thisSowTime < type(uint32).max) {
            if (
                s.sys.weather.lastSowTime == type(uint32).max || // Didn't Sow all last Season
                s.sys.weather.thisSowTime < SOW_TIME_DEMAND_INCR || // Sow'd all instantly this Season
                (s.sys.weather.lastSowTime > SOW_TIME_STEADY &&
                    s.sys.weather.thisSowTime < s.sys.weather.lastSowTime.sub(SOW_TIME_STEADY)) // Sow'd all faster
            ) {
                deltaPodDemand = Decimal.from(1e18);
            } else if (
                s.sys.weather.thisSowTime <= s.sys.weather.lastSowTime.add(SOW_TIME_STEADY)
            ) {
                // Sow'd all in same time
                deltaPodDemand = Decimal.one();
            } else {
                deltaPodDemand = Decimal.zero();
            }
        } else {
            // Soil didn't sell out
            uint256 lastDeltaSoil = s.sys.weather.lastDeltaSoil;

            if (dsoil == 0) {
                deltaPodDemand = Decimal.zero(); // If no one Sow'd
            } else if (lastDeltaSoil == 0) {
                deltaPodDemand = Decimal.from(1e18); // If no one Sow'd last Season
            } else {
                deltaPodDemand = Decimal.ratio(dsoil, lastDeltaSoil);
            }
        }

        lastSowTime = s.sys.weather.thisSowTime; // Overwrite last Season
        thisSowTime = type(uint32).max; // Reset for next Season
    }

    /**
     * @notice Calculates the liquidity to supply ratio, where liquidity is measured in USD.
     * @param beanSupply The total supply of Beans.
     * corresponding to the well addresses in the whitelist.
     * @dev No support for non-well AMMs at this time.
     */
    function calcLPToSupplyRatio(
        uint256 beanSupply
    )
        internal
        view
        returns (Decimal.D256 memory lpToSupplyRatio, address largestLiqWell, bool oracleFailure)
    {
        // prevent infinite L2SR
        if (beanSupply == 0) return (Decimal.zero(), address(0), true);

        address[] memory pools = LibWhitelistedTokens.getWhitelistedLpTokens();
        uint256[] memory twaReserves;
        uint256 totalUsdLiquidity;
        uint256 largestLiq;
        uint256 wellLiquidity;
        for (uint256 i; i < pools.length; i++) {
            // get the non-bean value in an LP.
            twaReserves = LibWell.getTwaReservesFromStorageOrBeanstalkPump(pools[i]);

            // calculate the non-bean usd liquidity value.
            uint256 usdLiquidity = LibWell.getWellTwaUsdLiquidityFromReserves(
                pools[i],
                twaReserves
            );

            // if the usdLiquidty is 0, beanstalk assumes oracle failure.
            if (usdLiquidity == 0) {
                oracleFailure = true;
            }

            // calculate the scaled, non-bean liquidity in the pool.
            wellLiquidity = getLiquidityWeight(pools[i]).mul(usdLiquidity).div(1e18);

            // if the liquidity is the largest, update `largestLiqWell`,
            // and add the liquidity to the total.
            // `largestLiqWell` is only used to initialize `s.sopWell` upon a sop,
            // but a hot storage load to skip the block below
            // is significantly more expensive than performing the logic on every sunrise.
            if (wellLiquidity > largestLiq) {
                largestLiq = wellLiquidity;
                largestLiqWell = pools[i];
            }

            totalUsdLiquidity = totalUsdLiquidity.add(wellLiquidity);

            if (pools[i] == LibBarnRaise.getBarnRaiseWell()) {
                // Scale down bean supply by the locked beans, if there is fertilizer to be paid off.
                // Note: This statement is put into the for loop to prevent another extraneous read of
                // the twaReserves from storage as `twaReserves` are already loaded into memory.
                if (LibAppStorage.diamondStorage().sys.season.fertilizing == true) {
                    beanSupply = beanSupply.sub(LibUnripe.getLockedBeans(twaReserves));
                }
            }

            // If a new non-Well LP is added, functionality to calculate the USD value of the
            // liquidity should be added here.
        }

        // if there is no liquidity,
        // return 0 to save gas.
        if (totalUsdLiquidity == 0) return (Decimal.zero(), address(0), true);

        // USD liquidity is scaled down from 1e18 to match Bean precision (1e6).
        lpToSupplyRatio = Decimal.ratio(totalUsdLiquidity.div(LIQUIDITY_PRECISION), beanSupply);
    }

    /**
     * @notice Get the deltaPodDemand, lpToSupplyRatio, and podRate, and update soil demand
     * parameters.
     */
    function updateAndGetBeanstalkState(
        uint256 beanSupply
    ) internal returns (BeanstalkState memory bs) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Calculate Delta Soil Demand
        uint256 dsoil = s.sys.beanSown;
        s.sys.beanSown = 0;
        (
            bs.deltaPodDemand,
            s.sys.weather.lastSowTime,
            s.sys.weather.thisSowTime
        ) = calcDeltaPodDemand(dsoil);
        s.sys.weather.lastDeltaSoil = uint128(dsoil); // SafeCast not necessary as `s.beanSown` is uint128.

        // Calculate Lp To Supply Ratio, fetching the twaReserves in storage:
        (bs.lpToSupplyRatio, bs.largestLiqWell, bs.oracleFailure) = calcLPToSupplyRatio(beanSupply);

        // Calculate PodRate
        bs.podRate = Decimal.ratio(
            s.sys.fields[s.sys.activeField].pods.sub(s.sys.fields[s.sys.activeField].harvestable),
            beanSupply
        ); // Pod Rate
    }

    /**
     * @notice Evaluates beanstalk based on deltaB, podRate, deltaPodDemand and lpToSupplyRatio.
     * and returns the associated caseId.
     */
    function evaluateBeanstalk(int256 deltaB, uint256 beanSupply) internal returns (uint256, bool) {
        BeanstalkState memory bs = updateAndGetBeanstalkState(beanSupply);
        uint256 caseId = evalPodRate(bs.podRate) // Evaluate Pod Rate
            .add(evalPrice(deltaB, bs.largestLiqWell))
            .add(evalDeltaPodDemand(bs.deltaPodDemand))
            .add(evalLpToSupplyRatio(bs.lpToSupplyRatio)); // Evaluate Price // Evaluate Delta Soil Demand // Evaluate LP to Supply Ratio
        return (caseId, bs.oracleFailure);
    }

    /**
     * @notice calculates the liquidity weight of a token.
     * @dev the liquidity weight determines the percentage of
     * liquidity that is used in evaluating the liquidity of bean.
     * At 0, no liquidity is added. at 1e18, all liquidity is added.
     * The function must be a non state, viewable function that returns a uint256.
     * if failure, returns 0 (no liquidity is considered) instead of reverting.
     * if the pool does not have a target, uses address(this).
     */
    function getLiquidityWeight(address pool) internal view returns (uint256 liquidityWeight) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Implementation memory lw = s.sys.silo.assetSettings[pool].liquidityWeightImplementation;

        // if the target is 0, use address(this).
        address target = lw.target;
        if (target == address(0)) target = address(this);

        (bool success, bytes memory data) = target.staticcall(abi.encodeWithSelector(lw.selector));

        if (!success) return 0;
        assembly {
            liquidityWeight := mload(add(data, add(0x20, 0)))
        }
    }
}
