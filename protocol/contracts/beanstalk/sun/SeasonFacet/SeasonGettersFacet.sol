// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage} from "../../AppStorage.sol";
import {C} from "../../../C.sol";
import {Decimal, SafeMath} from "contracts/libraries/Decimal.sol";
import {LibIncentive} from "contracts/libraries/LibIncentive.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
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
        deltaB = LibWellMinting.check(C.BEAN_ETH_WELL);
    }

    /**
     * @notice Returns the Time Weighted Average Delta B since the start of the Season for the requested pool.
     */
    function poolDeltaB(address pool) external view returns (int256) {
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
    function getBeanToMaxLpGpPerBdvRatioScaled() public view returns (uint256) {
        return LibGauge.getBeanToMaxLpGpPerBdvRatioScaled(s.seedGauge.beanToMaxLpGpPerBdvRatio);
    }

    /**
     * @notice returns the Gauge Points per BDV for a given token.
     * @param token The token to get the Gauge Points per BDV for.
     */
    function getGaugePointsPerBdvForToken(address token) public view returns (uint256) {
        if (token == C.BEAN) {
            return getBeanGaugePointsPerBdv();
        } else {
            return getGaugePointsPerBdvForWell(token);
        }
    }

    /**
     * gets the Gauge Points per BDV for a given well.
     * @param well The well to get the Gauge Points per BDV for.
     */
    function getGaugePointsPerBdvForWell(address well) public view returns (uint256) {
        if (LibWell.isWell(well)) {
            uint256 wellGaugePoints = s.ss[well].gaugePoints;
            uint256 wellDepositedBdv = s.siloBalances[well].depositedBdv;
            return wellGaugePoints.mul(LibGauge.BDV_PRECISION).div(wellDepositedBdv);
        } else {
            revert ("Token not supported");
        }
    }

    /**
     * @notice calculates the BEANETH Gauge Points (GP) per BDV.
     */
    function getBeanEthGaugePointsPerBdv() public view returns (uint256) {
        return getGaugePointsPerBdvForWell(C.BEAN_ETH_WELL);
    }

    /**
     * @notice calculates the BEAN Gauge Points (GP) per BDV.
     */
    function getBeanGaugePointsPerBdv() public view returns (uint256) {
        uint256 beanToMaxLpGpPerBdvRatio = getBeanToMaxLpGpPerBdvRatioScaled();
        return getBeanEthGaugePointsPerBdv().mul(beanToMaxLpGpPerBdvRatio).div(100e18);
    }

    /**
     * @notice calculates the grown stalk issued per season.
     */
    function getGrownStalkIssuedPerSeason() public view returns (uint256) {
        address[] memory lpGaugeTokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        uint256 totalLpBdv;
        for(uint i; i < lpGaugeTokens.length; i++) {
            totalLpBdv = totalLpBdv.add(s.siloBalances[lpGaugeTokens[i]].depositedBdv);
        }
        return uint256(s.seedGauge.averageGrownStalkPerBdvPerSeason)
            .mul(totalLpBdv.add(s.siloBalances[C.BEAN].depositedBdv))
            .div(LibGauge.BDV_PRECISION);
    }

    /**
     * @notice Gets the stalk per Gauge Point. Used In gauge system.
     */
    function getGrownStalkIssuedPerGp() external view returns (uint256) {
        address[] memory lpGaugeTokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        uint256 totalGaugePoints;
        for(uint i; i < lpGaugeTokens.length; i++) {
            totalGaugePoints = totalGaugePoints.add(s.ss[lpGaugeTokens[i]].gaugePoints);
        }
        uint256 newGrownStalk = getGrownStalkIssuedPerSeason();
        totalGaugePoints = totalGaugePoints
            .add(
                getBeanGaugePointsPerBdv()
                    .mul(s.siloBalances[C.BEAN].depositedBdv)
                    .div(LibGauge.BDV_PRECISION)
                );
        return newGrownStalk.mul(1e18).div(totalGaugePoints);
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
        (Decimal.D256 memory l2sr, ) = LibEvaluate.calcLPToSupplyRatio(beanSupply);
        return l2sr.value;
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
     * @notice returns the twa liquidity for a well, using the values stored in beanstalk.
     */
    function getTwaLiquidityForWell(address well) public view returns (uint256) {
        (address token, ) = LibWell.getNonBeanTokenAndIndexFromWell(well);
        return LibWell.getTwaLiquidityFromBeanstalkPump(
            well,
            LibUsdOracle.getTokenPrice(token)
        );
    }

    /**
     * @notice returns the twa liquidity for a well, using the values stored in beanstalk.
     * @dev This is the liquidity used in the gauge system.
     */
    function getWeightedTwaLiquidityForWell(address well) public view returns (uint256) {
        return LibEvaluate.getLiquidityWeight(s.ss[well].lwSelector)
            .mul(getTwaLiquidityForWell(well))
            .div(1e18);
    }

    /**
     * @notice Returns the total twa liquidity of beanstalk.
     */
    function getTotalUsdLiquidity() external view returns (uint256 totalLiquidity) {
        address[] memory wells = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint i; i < wells.length; i++) {
            totalLiquidity = totalLiquidity.add(getTwaLiquidityForWell(wells[i]));
        }
    }

    /** 
     * @notice returns the total weighted liquidity of beanstalk.
     */
    function getTotalWeightedUsdLiquidity() external view returns (uint256 totalWeightedLiquidity) {
        address[] memory wells = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint i; i < wells.length; i++) {
            totalWeightedLiquidity = totalWeightedLiquidity.add(
                getWeightedTwaLiquidityForWell(wells[i])
            );
        }
    }

    /**
     * @notice Returns the current gauge points of a token.
     */
    function getGaugePoints(address token) external view returns (uint256) {
        return s.ss[token].gaugePoints;
    }

    function getLargestLiqWell() external view returns (address) {
       uint256 beanSupply = C.bean().totalSupply();
        (, address well) = LibEvaluate.calcLPToSupplyRatio(beanSupply);
        return well;
    }

    function getSopWell() external view returns (address) {
        return s.sopWell;
    }
}
