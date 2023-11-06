// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage} from "../../AppStorage.sol";
import {C} from "../../../C.sol";
import {Decimal, SafeMath} from "contracts/libraries/Decimal.sol";
import {LibIncentive} from "contracts/libraries/LibIncentive.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibBeanMetaCurve} from "contracts/libraries/Curve/LibBeanMetaCurve.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";

/**
 * @title SeasonGettersFacet
 * @author Publius, Chaikitty, Brean
 * @notice Holds Getter view functions for the SeasonFacet.
 */
contract SeasonGettersFacet {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    AppStorage internal s;

    uint256 constant ONE_WEEK = 168;

    //////////////////// SEASON GETTERS ////////////////////

    /**
     * @notice Returns the current Season number.
     */
    function season() public view returns (uint32) {
        return s.season.current;
    }

    /**
     * @notice Returns whether Beanstalk is Paused. When Paused, the `sunrise()` function cannot be called.
     */
    function paused() public view returns (bool) {
        return s.paused;
    }

    /**
     * @notice Returns the Season struct. See {Storage.Season}.
     */
    function time() external view returns (Storage.Season memory) {
        return s.season;
    }

    /**
     * @notice Returns whether Beanstalk started this Season above or below peg.
     */
    function abovePeg() external view returns (bool) {
        return s.season.abovePeg;
    }

    /**
     * @notice Returns the block during which the current Season started.
     */
    function sunriseBlock() external view returns (uint32) {
        return s.season.sunriseBlock;
    }

    /**
     * @notice Returns the current Weather struct. See {AppStorage:Storage.Weather}.
     */
    function weather() public view returns (Storage.Weather memory) {
        return s.w;
    }

    /**
     * @notice Returns the current Rain struct. See {AppStorage:Storage.Rain}.
     */
    function rain() public view returns (Storage.Rain memory) {
        return s.r;
    }

    /**
     * @notice Returns the Plenty per Root for `season`.
     */
    function plentyPerRoot(uint32 _season) external view returns (uint256) {
        return s.sops[_season];
    }

    //////////////////// ORACLE GETTERS ////////////////////

    /**
     * @notice Returns the total Delta B across all whitelisted minting liquidity pools.
     * @dev The whitelisted pools are:
     * - the Bean:3Crv Metapool
     * - the Bean:ETH Well
     */
    function totalDeltaB() external view returns (int256 deltaB) {
        deltaB = LibCurveMinting.check().add(LibWellMinting.check(C.BEAN_ETH_WELL));
    }

    /**
     * @notice Returns the Time Weighted Average Delta B since the start of the Season for the requested pool.
     */
    function poolDeltaB(address pool) external view returns (int256) {
        if (pool == C.CURVE_BEAN_METAPOOL) return LibCurveMinting.check();
        if (LibWell.isWell(pool)) return LibWellMinting.check(pool);
        revert("Oracle: Pool not supported");
    }

    /**
     * @notice Returns the last Well Oracle Snapshot for a given `well`.
     * @return snapshot The encoded cumulative balances the last time the Oracle was captured.
     */
    function wellOracleSnapshot(address well) external view returns (bytes memory snapshot) {
        snapshot = s.wellOracleSnapshots[well];
    }

    /**
     * @notice Returns the last Curve Oracle data snapshot for the Bean:3Crv Pool.
     * @return co The last Curve Oracle data snapshot.
     */
    function curveOracle() external view returns (Storage.CurveMetapoolOracle memory co) {
        co = s.co;
        co.timestamp = s.season.timestamp; // use season timestamp for oracle
    }

    //////////////////// SEED GAUGE GETTERS ////////////////////

    /**
     * @notice Returns the average grown stalk per BDV.
     */
    function getAverageGrownStalkPerBdv() public view returns (uint256) {
        return LibGauge.getAverageGrownStalkPerBdv();
    }

    /**
     * @notice Returns the total Deposited BDV in Beanstalk.
     * @dev the total Deposited BDV may vary from the instantaneous BDV of all Deposited tokens
     * as the BDV of a Deposit is only updated when a Deposit is interacted with.
     */
    function getTotalBdv() external view returns (uint256 totalBdv) {
        return LibGauge.getTotalBdv();
    }

    /**
     * @notice Returns the seed gauge struct.
     */
    function getSeedGauge() external view returns (Storage.SeedGauge memory) {
        return s.seedGauge;
    }

    /**
     * @notice Returns the average grown stalk per BDV per season.
     * @dev 6 decimal precision (1 GrownStalkPerBdvPerSeason = 1e6);
     * note that stalk has 10 decimals.
     */
    function getAverageGrownStalkPerBdvPerSeason() public view returns (uint128) {
        return s.seedGauge.averageGrownStalkPerBdvPerSeason;
    }

    /**
     * @notice Returns the new average grown stalk per BDV per season,
     * if updateStalkPerBdvPerSeason() is called.
     * @dev 6 decimal precision (1 GrownStalkPerBdvPerSeason = 1e6);
     * note that stalk has 10 decimals.
     */
    function getNewAverageGrownStalkPerBdvPerSeason() external view returns (uint256) {
        return
            getAverageGrownStalkPerBdv().mul(LibGauge.BDV_PRECISION).div(
                LibGauge.TARGET_SEASONS_TO_CATCHUP
            );
    }

    /**
     * @notice Returns the ratio between bean and max LP gp Per BDV, unscaled.
     * @dev 6 decimal precision (1% = 1e6)
     */
    function getBeanToMaxLpGpPerBdvRatio() external view returns (uint256) {
        return s.seedGauge.beanToMaxLpGpPerBdvRatio;
    }

    /**
     * @notice Returns the ratio between bean and max LP gp Per BDV, scaled.
     * @dev 6 decimal precision (1% = 1e6)
     */
    function getBeanToMaxLpGpPerBdvRatioScaled() external view returns (uint256) {
        return LibGauge.getBeanToMaxLpGpPerBdvRatioScaled(s.seedGauge.beanToMaxLpGpPerBdvRatio);
    }

    /**
     * @notice returns the season in which the stalk growth rate was last updated.
     */
    function getLastSeedGaugeUpdate() external view returns (uint256) {
        return s.seedGauge.lastSeedGaugeUpdate;
    }

    /**
     * @notice returns the next season in that beanstalk will update the stalk growth rate.
     */
    function getNextSeedGaugeUpdate() external view returns (uint256) {
        return uint256(s.seedGauge.lastSeedGaugeUpdate).add(ONE_WEEK);
    }

    /**
     * @notice Returns the pod rate (unharvestable pods / total bean supply).
     */
    function getPodRate() external view returns (uint256) {
        uint256 beanSupply = C.bean().totalSupply();
        return Decimal.ratio(s.f.pods.sub(s.f.harvestable), beanSupply).value;
    }

    /**
     * @notice Returns the L2SR rate (total non-bean liquidity / total bean supply).
     */
    function getLiquidityToSupplyRatio() external view returns (uint256) {
        uint256 beanSupply = C.bean().totalSupply();
        return LibEvaluate.calcLPToSupplyRatio(beanSupply).value;
    }

    /**
     * @notice returns the change in demand for pods from the previous season.
     */
    function getDeltaPodDemand() external view returns (uint256) {
        Decimal.D256 memory deltaPodDemand;
        (deltaPodDemand, , ) = LibEvaluate.calcDeltaPodDemand(s.f.beanSown);
        return deltaPodDemand.value;
    }

    /**
     * @notice returns the MEV manipulatation resistant non-bean liqudity
     * from the bean:3CRV factory pool. 
     */
    function getBean3CRVLiquidity() public view returns (uint256 usdLiquidity) {
        return LibBeanMetaCurve.totalLiquidityUsd();
    }

    /**
     * @notice returns the twa beanEth liquidity, using the values stored in beanstalk.
     */
    function getBeanEthTwaUsdLiquidity() public view returns (uint256) {
        return LibWell.getTwaLiquidityFromBeanstalkPump(
            C.BEAN_ETH_WELL,
            LibUsdOracle.getTokenPrice(C.WETH)
        );
    }

    
    /**
     * @notice returns the non-bean usd total liquidity of bean.
     */
    function getTotalUsdLiquidity() external view returns (uint256) {
        return getBean3CRVLiquidity().add(getBeanEthTwaUsdLiquidity());
    }

    /**
     * @notice Returns the current gauge points of a token.
     */
    function getGaugePoints(address token) external view returns (uint256) {
        return s.ss[token].gaugePoints;
    }
}
