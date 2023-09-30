// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../AppStorage.sol";
import "../../../C.sol";
import {Decimal, SafeMath} from "contracts/libraries/Decimal.sol";
import {LibIncentive} from "contracts/libraries/LibIncentive.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";

/**
 * @title SeasonGetterFacet
 * @author Publius, Chaikitty
 * @notice Holds Getter view functions for the SeasonFacet.
 */
contract SeasonGetterFacet {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    AppStorage internal s;

    // 24 * 30 * 6
    uint256 private constant TARGET_SEASONS_TO_CATCHUP = 4320;
    uint256 private constant PRECISION = 1e6;
    uint256 private constant STALK_BDV_PRECISION = 1e4;

    event UpdateStalkPerBdvPerSeason(uint256 newStalkPerBdvPerSeason);

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
    function sunriseBlock() external view returns (uint32){
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
        deltaB = LibCurveMinting.check().add(
            LibWellMinting.check(C.BEAN_ETH_WELL)
        );
    }

    /**
     * @notice Returns the current Delta B for the requested pool.
     */
    function poolDeltaB(address pool) external view returns (int256) {
        if (pool == C.CURVE_BEAN_METAPOOL) return LibCurveMinting.check();
        if (LibWell.isWell(pool)) return LibWellMinting.check(pool);
        revert("Oracle: Pool not supported");
    }

    /**
     * @notice Returns thelast Well Oracle Snapshot for a given `well`.
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
     * @notice returns the average grown stalk per BDV .
     */
    function getAverageGrownStalkPerBdv() public view returns (uint256) {
        uint256 totalBdv = getTotalBdv();
        if(totalBdv == 0) return 0;
        return s.s.stalk.div(totalBdv).sub(STALK_BDV_PRECISION); 
    }

    /**
     * @notice updates the updateStalkPerBdvPerSeason in the seed gauge.
     * @dev anyone can call this function to update. Currently, the function 
     * updates the targetGrownStalkPerBdvPerSeason such that it will take 6 months
     * for the average new depositer to catch up to the average grown stalk per BDV.
     * 
     * The expectation is that actors will call this function on their own as it benefits them.
     * Newer depositers will call it if the value increases to catch up to the average faster,
     * Older depositers will call it if the value decreases to slow down their rate of dilution.
     */
    function updateStalkPerBdvPerSeason() external {
        s.seedGauge.averageGrownStalkPerBdvPerSeason = uint128(
            getAverageGrownStalkPerBdv().mul(PRECISION).div(TARGET_SEASONS_TO_CATCHUP)
        );
        emit UpdateStalkPerBdvPerSeason(s.seedGauge.averageGrownStalkPerBdvPerSeason);
    }

    /**
     * @notice returns the total BDV in beanstalk.
     * @dev the total BDV may differ from the instaneous BDV,
     * as BDV is asyncronous. 
     */
    function getTotalBdv() internal view returns (uint256 totalBdv) {
        address[] memory whitelistedSiloTokens = LibWhitelistedTokens.getSiloTokens(); 
        // TODO: implment the decrement deposited BDV thing for unripe
        for (uint256 i; i < whitelistedSiloTokens.length; ++i) {
            totalBdv = totalBdv.add(s.siloBalances[whitelistedSiloTokens[i]].depositedBdv);
        }
    }

    /**
     * @notice returns the seed gauge struct.
     */
    function getSeedGauge() external view returns (Storage.SeedGauge memory) {
        return s.seedGauge;
    }
    
    /**
     * @notice returns the average grown stalk per BDV per season. 
     * @dev 6 decimal precision (1 GrownStalkPerBdvPerSeason = 1e6);
     * note that stalk has 10 decimals. 
     */
    function getAverageGrownStalkPerBdvPerSeason() public view returns (uint128) {
        return s.seedGauge.averageGrownStalkPerBdvPerSeason;
    }

    /**
     * @notice returns the new average grown stalk per BDV per season, 
     * if updateStalkPerBdvPerSeason() is called.
     * @dev 6 decimal precision (1 GrownStalkPerBdvPerSeason = 1e6);
     * note that stalk has 10 decimals. 
     */
    function getNewAverageGrownStalkPerBdvPerSeason() external view returns (uint256) {
        return getAverageGrownStalkPerBdv().mul(PRECISION).div(TARGET_SEASONS_TO_CATCHUP);
    }

    /**
     * @notice returns the ratio between bean and max LP gp Per BDV, unscaled.
     * @dev 6 decimal precision (1% = 1e6)
     */
    function getBeanToMaxLpGPperBDVRatio() external view returns (uint256) {
        return s.seedGauge.BeanToMaxLpGpPerBDVRatio;
    }

    /**
     * @notice returns the ratio between bean and max LP gp Per BDV, scaled.
     * @dev 6 decimal precision (1% = 1e6)
     */
    function getBeanToMaxLpGPperBDVRatioScaled() external view returns (uint256) {
        return LibGauge.getBeanToMaxLpGpPerBDVRatioScaled(s.seedGauge.BeanToMaxLpGpPerBDVRatio);
    }
    

    /**
     * @notice returns the pod rate (unharvestable pods / total bean supply)
     */
    function getPodRate() external view returns (uint256) {
        uint256 beanSupply = C.bean().totalSupply();
        return Decimal.ratio(
            s.f.pods.sub(s.f.harvestable),
            beanSupply
        ).value;
    }

    /**
     * @notice returns the L2SR rate (total non-bean liquidity / total bean supply)
     */
    function getLiquidityToSupplyRatio() external view returns (uint256) {
        uint256 beanSupply = C.bean().totalSupply();
        return LibEvaluate.calcLPToSupplyRatio(beanSupply).value;
    }

    /**
     * @notice gets the change in demand for pods from the previous season.
     */
    function getDeltaPodDemand() external view returns (uint256) {
        Decimal.D256 memory deltaPodDemand;
        (deltaPodDemand, ,) = LibEvaluate.calcDeltaPodDemand(s.f.beanSown);
        return deltaPodDemand.value;
    }

    /**
     * @notice gets the non-bean liquidity for a given well.
     */
    function getUsdLiquidity(address well) external view returns (uint256) {
        return LibWell.getUsdLiquidity(well);
    }

    function getGaugePoints(address token) external view returns (uint256) {
        return s.ss[token].gaugePoints;
    }
    
}
