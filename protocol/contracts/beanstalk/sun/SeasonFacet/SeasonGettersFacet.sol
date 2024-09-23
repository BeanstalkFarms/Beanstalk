// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage} from "../../storage/AppStorage.sol";
import {Season, Weather, Rain, EvaluationParameters, Deposited, AssetSettings} from "../../storage/System.sol";
import {Decimal} from "contracts/libraries/Decimal.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";
import {LibFlood} from "contracts/libraries/Silo/LibFlood.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";

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
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        if (tokens.length == 0) return 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            deltaB = deltaB.add(LibWellMinting.check(tokens[i]));
        }
    }

    /**
     * @notice Returns the Time Weighted Average Delta B since the start of the Season for the requested pool.
     */
    function poolDeltaB(address pool) external view returns (int256) {
        if (LibWell.isWell(pool)) return LibWellMinting.check(pool);
        revert("Oracle: Pool not supported");
    }

    function poolCurrentDeltaB(address pool) public view returns (int256 deltaB) {
        if (LibWell.isWell(pool)) {
            (deltaB) = LibDeltaB.currentDeltaB(pool);
            return deltaB;
        } else {
            revert("Oracle: Pool not supported");
        }
    }

    function cumulativeCurrentDeltaB(
        address[] calldata pools
    ) external view returns (int256 deltaB) {
        for (uint256 i; i < pools.length; i++) {
            deltaB += poolCurrentDeltaB(pools[i]);
        }
    }

    /**
     * @notice Returns the last Well Oracle Snapshot for a given `well`.
     * @return snapshot The encoded cumulative balances the last time the Oracle was captured.
     */
    function wellOracleSnapshot(address well) external view returns (bytes memory snapshot) {
        snapshot = s.sys.wellOracleSnapshots[well];
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

    function getLargestLiqWell() external view returns (address) {
        uint256 beanSupply = BeanstalkERC20(s.sys.tokens.bean).totalSupply();
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

    function getEvaluationParameters() external view returns (EvaluationParameters memory) {
        return s.sys.evaluationParameters;
    }

    function getMaxBeanMaxLpGpPerBdvRatio() external view returns (uint256) {
        return s.sys.evaluationParameters.maxBeanMaxLpGpPerBdvRatio;
    }

    function getMinBeanMaxLpGpPerBdvRatio() external view returns (uint256) {
        return s.sys.evaluationParameters.minBeanMaxLpGpPerBdvRatio;
    }

    function getTargetSeasonsToCatchUp() external view returns (uint256) {
        return s.sys.evaluationParameters.targetSeasonsToCatchUp;
    }

    function getPodRateLowerBound() external view returns (uint256) {
        return s.sys.evaluationParameters.podRateLowerBound;
    }

    function getPodRateOptimal() external view returns (uint256) {
        return s.sys.evaluationParameters.podRateOptimal;
    }

    function getPodRateUpperBound() external view returns (uint256) {
        return s.sys.evaluationParameters.podRateUpperBound;
    }

    function getDeltaPodDemandLowerBound() external view returns (uint256) {
        return s.sys.evaluationParameters.deltaPodDemandLowerBound;
    }

    function getDeltaPodDemandUpperBound() external view returns (uint256) {
        return s.sys.evaluationParameters.deltaPodDemandUpperBound;
    }

    function getLpToSupplyRatioUpperBound() external view returns (uint256) {
        return s.sys.evaluationParameters.lpToSupplyRatioUpperBound;
    }

    function getLpToSupplyRatioOptimal() external view returns (uint256) {
        return s.sys.evaluationParameters.lpToSupplyRatioOptimal;
    }

    function getLpToSupplyRatioLowerBound() external view returns (uint256) {
        return s.sys.evaluationParameters.lpToSupplyRatioLowerBound;
    }

    function getExcessivePriceThreshold() external view returns (uint256) {
        return s.sys.evaluationParameters.excessivePriceThreshold;
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
