// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage} from "../../storage/AppStorage.sol";
import {Season, SeedGauge, Weather, Rain, SeedGaugeSettings, Deposited, GerminationSide, AssetSettings} from "../../storage/System.sol";
import {C} from "../../../C.sol";
import {Decimal} from "contracts/libraries/Decimal.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";
import {LibFlood} from "contracts/libraries/Silo/LibFlood.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";

/**
 * @title SeasonGettersFacet
 * @author Publius, Chaikitty, Brean
 * @notice Holds Getter view functions for the SeasonFacet.
 */
contract SeasonGettersFacet {
    using LibRedundantMath256 for uint256;
    using LibRedundantMathSigned256 for int256;

    AppStorage internal s;

    //////////////////// SEASON GETTERS ////////////////////

    /**
     * @notice Returns the current Season number.
     */
    function season() public view returns (uint32) {
        return s.sys.season.current;
    }

    /**
     * @notice Returns whether Beanstalk is Paused. When Paused, the `sunrise()` function cannot be called.
     */
    function paused() public view returns (bool) {
        return s.sys.paused;
    }

    /**
     * @notice Returns the Season struct. See {Season}.
     */
    function time() external view returns (Season memory) {
        return s.sys.season;
    }

    /**
     * @notice Returns whether Beanstalk started this Season above or below peg.
     */
    function abovePeg() external view returns (bool) {
        return s.sys.season.abovePeg;
    }

    /**
     * @notice Returns the block during which the current Season started.
     */
    function sunriseBlock() external view returns (uint32) {
        return s.sys.season.sunriseBlock;
    }

    /**
     * @notice Returns the current Weather struct. See {Weather}.
     */
    function weather() public view returns (Weather memory) {
        return s.sys.weather;
    }

    /**
     * @notice Returns the current Rain struct. See {AppStorage:Rain}.
     */
    function rain() public view returns (Rain memory) {
        return s.sys.rain;
    }

    /**
     * @notice Returns the Plenty per Root for `season`.
     */
    function plentyPerRoot(uint32 _season, address well) external view returns (uint256) {
        return s.sys.sop.sops[_season][well];
    }

    //////////////////// ORACLE GETTERS ////////////////////

    /**
     * @notice Returns the total Delta B across all whitelisted minting liquidity Wells.
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

    function poolCurrentDeltaB(address pool) external view returns (int256 deltaB) {
        if (LibWell.isWell(pool)) {
            (deltaB) = LibDeltaB.currentDeltaB(pool);
            return deltaB;
        } else {
            revert("Oracle: Pool not supported");
        }
    }

    /**
     * @notice Returns the last Well Oracle Snapshot for a given `well`.
     * @return snapshot The encoded cumulative balances the last time the Oracle was captured.
     */
    function wellOracleSnapshot(address well) external view returns (bytes memory snapshot) {
        snapshot = s.sys.wellOracleSnapshots[well];
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
    function getSeedGauge() external view returns (SeedGauge memory) {
        return s.sys.seedGauge;
    }

    /**
     * @notice Returns the average grown stalk per BDV per season.
     * @dev 6 decimal precision (1 GrownStalkPerBdvPerSeason = 1e6);
     * note that stalk has 10 decimals.
     */
    function getAverageGrownStalkPerBdvPerSeason() public view returns (uint128) {
        return s.sys.seedGauge.averageGrownStalkPerBdvPerSeason;
    }

    /**
     * @notice Returns the ratio between bean and max LP gp Per BDV, unscaled.
     * @dev 6 decimal precision (1% = 1e6)
     */
    function getBeanToMaxLpGpPerBdvRatio() external view returns (uint256) {
        return s.sys.seedGauge.beanToMaxLpGpPerBdvRatio;
    }

    /**
     * @notice Returns the ratio between bean and max LP gp Per BDV, scaled.
     * @dev 6 decimal precision (1% = 1e6)
     */
    function getBeanToMaxLpGpPerBdvRatioScaled() public view returns (uint256) {
        return LibGauge.getBeanToMaxLpGpPerBdvRatioScaled(s.sys.seedGauge.beanToMaxLpGpPerBdvRatio);
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
            uint256 wellGaugePoints = s.sys.silo.assetSettings[well].gaugePoints;
            uint256 wellDepositedBdv = s.sys.silo.balances[well].depositedBdv;
            return wellGaugePoints.mul(LibGauge.BDV_PRECISION).div(wellDepositedBdv);
        } else {
            revert("Token not supported");
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
        for (uint i; i < lpGaugeTokens.length; i++) {
            totalLpBdv = totalLpBdv.add(s.sys.silo.balances[lpGaugeTokens[i]].depositedBdv);
        }
        return
            uint256(s.sys.seedGauge.averageGrownStalkPerBdvPerSeason)
                .mul(totalLpBdv.add(s.sys.silo.balances[C.BEAN].depositedBdv))
                .div(LibGauge.BDV_PRECISION);
    }

    /**
     * @notice Gets the stalk per Gauge Point. Used In gauge system.
     */
    function getGrownStalkIssuedPerGp() external view returns (uint256) {
        address[] memory lpGaugeTokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        uint256 totalGaugePoints;
        for (uint i; i < lpGaugeTokens.length; i++) {
            totalGaugePoints = totalGaugePoints.add(
                s.sys.silo.assetSettings[lpGaugeTokens[i]].gaugePoints
            );
        }
        uint256 newGrownStalk = getGrownStalkIssuedPerSeason();
        totalGaugePoints = totalGaugePoints.add(
            getBeanGaugePointsPerBdv().mul(s.sys.silo.balances[C.BEAN].depositedBdv).div(
                LibGauge.BDV_PRECISION
            )
        );
        return newGrownStalk.mul(1e18).div(totalGaugePoints);
    }

    /**
     * @notice Returns the pod rate (unharvestable pods / total bean supply).
     */
    function getPodRate(uint256 fieldId) external view returns (uint256) {
        uint256 beanSupply = C.bean().totalSupply();
        return
            Decimal
                .ratio(s.sys.fields[fieldId].pods - s.sys.fields[fieldId].harvestable, beanSupply)
                .value;
    }

    /**
     * @notice Returns the L2SR rate (total non-bean liquidity / total bean supply).
     */
    function getLiquidityToSupplyRatio() external view returns (uint256) {
        uint256 beanSupply = C.bean().totalSupply();
        (Decimal.D256 memory l2sr, , ) = LibEvaluate.calcLPToSupplyRatio(beanSupply);
        return l2sr.value;
    }

    /**
     * @notice returns the change in demand for pods from the previous season.
     */
    function getDeltaPodDemand() external view returns (uint256) {
        Decimal.D256 memory deltaPodDemand;
        (deltaPodDemand, , ) = LibEvaluate.calcDeltaPodDemand(s.sys.beanSown);
        return deltaPodDemand.value;
    }

    /**
     * @notice returns the twa liquidity for a well, using the values stored in beanstalk.
     */
    function getTwaLiquidityForWell(address well) public view returns (uint256) {
        (address token, ) = LibWell.getNonBeanTokenAndIndexFromWell(well);
        return LibWell.getTwaLiquidityFromPump(well, LibUsdOracle.getTokenPrice(token));
    }

    /**
     * @notice returns the twa liquidity for a well, using the values stored in beanstalk.
     * @dev This is the liquidity used in the gauge system.
     */
    function getWeightedTwaLiquidityForWell(address well) public view returns (uint256) {
        return LibEvaluate.getLiquidityWeight(well).mul(getTwaLiquidityForWell(well)).div(1e18);
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
        return s.sys.silo.assetSettings[token].gaugePoints;
    }

    /**
     * @notice returns the new gauge point for a token,
     * if it were to be updated with the given parameters.
     */
    function calcGaugePointsWithParams(
        address token,
        uint256 percentOfDepositedBdv
    ) external view returns (uint256) {
        return LibGauge.calcGaugePoints(s.sys.silo.assetSettings[token], percentOfDepositedBdv);
    }

    /**
     * @notice returns the new gauge point for a token,
     * if it were to be updated with the current state.
     */
    function getGaugePointsWithParams(address token) external view returns (uint256) {
        address[] memory whitelistedLpTokens = LibWhitelistedTokens.getWhitelistedLpTokens();

        // get the germinating assets that will finish germination in the next season.
        GerminationSide side;
        if (
            LibGerminate.getGerminationStateForSeason(s.sys.season.current + 1) ==
            GerminationSide.ODD
        ) {
            side = GerminationSide.ODD;
        } else {
            side = GerminationSide.EVEN;
        }

        // Summate total deposited BDV across all whitelisted LP tokens.
        uint256 totalLpBdv;
        for (uint256 i; i < whitelistedLpTokens.length; ++i) {
            uint256 finishedGerminatingBdv = s
            .sys
            .silo
            .germinating[side][whitelistedLpTokens[i]].bdv;
            totalLpBdv = totalLpBdv
                .add(s.sys.silo.balances[whitelistedLpTokens[i]].depositedBdv)
                .add(finishedGerminatingBdv);
        }
        uint256 depositedBdv = s.sys.silo.balances[token].depositedBdv;
        uint256 percentDepositedBdv = depositedBdv.mul(100e6).div(totalLpBdv);

        AssetSettings memory ss = s.sys.silo.assetSettings[token];
        return LibGauge.calcGaugePoints(ss, percentDepositedBdv);
    }

    function getLargestLiqWell() external view returns (address) {
        uint256 beanSupply = C.bean().totalSupply();
        (, address well, ) = LibEvaluate.calcLPToSupplyRatio(beanSupply);
        return well;
    }

    //////////////////// CASES ////////////////////

    function getCases() external view returns (bytes32[144] memory cases) {
        return s.sys.casesV2;
    }

    function getCaseData(uint256 caseId) external view returns (bytes32 casesData) {
        return LibCases.getDataFromCase(caseId);
    }

    function getChangeFromCaseId(uint256 caseId) public view returns (uint32, int8, uint80, int80) {
        LibCases.CaseData memory cd = LibCases.decodeCaseData(caseId);
        return (cd.mT, cd.bT, cd.mL, cd.bL);
    }

    function getAbsTemperatureChangeFromCaseId(uint256 caseId) external view returns (int8 t) {
        (, t, , ) = getChangeFromCaseId(caseId);
        return t;
    }

    function getRelTemperatureChangeFromCaseId(uint256 caseId) external view returns (uint32 mt) {
        (mt, , , ) = getChangeFromCaseId(caseId);
        return mt;
    }

    function getAbsBeanToMaxLpRatioChangeFromCaseId(
        uint256 caseId
    ) external view returns (uint80 ml) {
        (, , ml, ) = getChangeFromCaseId(caseId);
        return ml;
    }

    function getRelBeanToMaxLpRatioChangeFromCaseId(
        uint256 caseId
    ) external view returns (int80 l) {
        (, , , l) = getChangeFromCaseId(caseId);
        return l;
    }

    function getSeasonStruct() external view returns (Season memory) {
        return s.sys.season;
    }

    function getSeasonTimestamp() external view returns (uint256) {
        return s.sys.season.timestamp;
    }

    function getSeedGaugeSetting() external view returns (SeedGaugeSettings memory) {
        return s.sys.seedGaugeSettings;
    }

    function getMaxBeanMaxLpGpPerBdvRatio() external view returns (uint256) {
        return s.sys.seedGaugeSettings.maxBeanMaxLpGpPerBdvRatio;
    }

    function getMinBeanMaxLpGpPerBdvRatio() external view returns (uint256) {
        return s.sys.seedGaugeSettings.minBeanMaxLpGpPerBdvRatio;
    }

    function getTargetSeasonsToCatchUp() external view returns (uint256) {
        return s.sys.seedGaugeSettings.targetSeasonsToCatchUp;
    }

    function getPodRateLowerBound() external view returns (uint256) {
        return s.sys.seedGaugeSettings.podRateLowerBound;
    }

    function getPodRateOptimal() external view returns (uint256) {
        return s.sys.seedGaugeSettings.podRateOptimal;
    }

    function getPodRateUpperBound() external view returns (uint256) {
        return s.sys.seedGaugeSettings.podRateUpperBound;
    }

    function getDeltaPodDemandLowerBound() external view returns (uint256) {
        return s.sys.seedGaugeSettings.deltaPodDemandLowerBound;
    }

    function getDeltaPodDemandUpperBound() external view returns (uint256) {
        return s.sys.seedGaugeSettings.deltaPodDemandUpperBound;
    }

    function getLpToSupplyRatioUpperBound() external view returns (uint256) {
        return s.sys.seedGaugeSettings.lpToSupplyRatioUpperBound;
    }

    function getLpToSupplyRatioOptimal() external view returns (uint256) {
        return s.sys.seedGaugeSettings.lpToSupplyRatioOptimal;
    }

    function getLpToSupplyRatioLowerBound() external view returns (uint256) {
        return s.sys.seedGaugeSettings.lpToSupplyRatioLowerBound;
    }

    function getExcessivePriceThreshold() external view returns (uint256) {
        return s.sys.seedGaugeSettings.excessivePriceThreshold;
    }

    function getWellsByDeltaB()
        external
        view
        returns (
            LibFlood.WellDeltaB[] memory wellDeltaBs,
            uint256 totalPositiveDeltaB,
            uint256 totalNegativeDeltaB,
            uint256 positiveDeltaBCount
        )
    {
        return LibFlood.getWellsByDeltaB();
    }
}
