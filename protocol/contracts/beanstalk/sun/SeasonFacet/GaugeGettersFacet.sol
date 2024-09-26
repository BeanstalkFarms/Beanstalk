// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage} from "../../storage/AppStorage.sol";
import {SeedGauge, GerminationSide, AssetSettings} from "../../storage/System.sol";
import {Decimal} from "contracts/libraries/Decimal.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";

/**
 * @title GaugeGettersFacet
 * @author Brean
 * @notice Holds Getter view functions for Gauge-related Functionality.
 */
contract GaugeGettersFacet {
    using LibRedundantMath256 for uint256;
    using LibRedundantMathSigned256 for int256;

    AppStorage internal s;

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
        if (token == s.sys.tokens.bean) {
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
            // avoid division by zero when no BDV is deposited or initial deposits are still germinating.
            if (wellDepositedBdv == 0) return 0;
            return wellGaugePoints.mul(LibGauge.BDV_PRECISION).div(wellDepositedBdv);
        } else {
            revert("Token not supported");
        }
    }

    function getLargestGpPerBdv() public view returns (uint256) {
        uint256 largestGpPerBdv;
        address[] memory whitelistedLpTokens = LibWhitelistedTokens.getWhitelistedLpTokens();
        for (uint256 i; i < whitelistedLpTokens.length; i++) {
            uint256 gpPerBdv = getGaugePointsPerBdvForWell(whitelistedLpTokens[i]);
            if (gpPerBdv > largestGpPerBdv) largestGpPerBdv = gpPerBdv;
        }
        return largestGpPerBdv;
    }

    /**
     * @notice calculates the BEAN Gauge Points (GP) per BDV.
     */
    function getBeanGaugePointsPerBdv() public view returns (uint256) {
        uint256 beanToMaxLpGpPerBdvRatio = getBeanToMaxLpGpPerBdvRatioScaled();
        return getLargestGpPerBdv().mul(beanToMaxLpGpPerBdvRatio).div(100e18);
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
                .mul(totalLpBdv.add(s.sys.silo.balances[s.sys.tokens.bean].depositedBdv))
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
            getBeanGaugePointsPerBdv().mul(s.sys.silo.balances[s.sys.tokens.bean].depositedBdv).div(
                LibGauge.BDV_PRECISION
            )
        );
        return newGrownStalk.mul(1e18).div(totalGaugePoints);
    }

    /**
     * @notice Returns the pod rate (unharvestable pods / total bean supply).
     */
    function getPodRate(uint256 fieldId) external view returns (uint256) {
        uint256 beanSupply = BeanstalkERC20(s.sys.tokens.bean).totalSupply();
        return
            Decimal
                .ratio(s.sys.fields[fieldId].pods - s.sys.fields[fieldId].harvestable, beanSupply)
                .value;
    }

    /**
     * @notice Returns the L2SR rate (total non-bean liquidity / total bean supply).
     */
    function getLiquidityToSupplyRatio() external view returns (uint256) {
        uint256 beanSupply = BeanstalkERC20(s.sys.tokens.bean).totalSupply();
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
}
