// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibRedundantMath128} from "contracts/libraries/LibRedundantMath128.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {Oracle, C} from "./Oracle.sol";
import {Distribution} from "./Distribution.sol";
import {LibShipping} from "contracts/libraries/LibShipping.sol";

/**
 * @title Sun
 * @author Publius
 * @notice Sun controls the minting of new Beans to Fertilizer, the Field, and the Silo.
 */
contract Sun is Oracle, Distribution {
    using SafeCast for uint256;
    using LibRedundantMath256 for uint256;
    using LibRedundantMath128 for uint128;

    /// @dev When the Pod Rate is high, issue less Soil.
    uint256 private constant SOIL_COEFFICIENT_HIGH = 0.5e18;

    /// @dev When the Pod Rate is low, issue more Soil.
    uint256 private constant SOIL_COEFFICIENT_LOW = 1.5e18;

    /**
     * @notice Emitted during Sunrise when Beanstalk adjusts the amount of available Soil.
     * @param season The Season in which Soil was adjusted.
     * @param soil The new amount of Soil available.
     */
    event Soil(uint32 indexed season, uint256 soil);

    //////////////////// SUN INTERNAL ////////////////////

    /**
     * @param deltaB Pre-calculated deltaB from {Oracle.stepOracle}.
     * @param caseId Pre-calculated Weather case from {Weather.calcCaseId}.
     */
    function stepSun(int256 deltaB, uint256 caseId) internal {
        // Above peg
        if (deltaB > 0) {
            uint256 priorHarvestable = s.sys.fields[s.sys.activeField].harvestable;

            C.bean().mint(address(this), uint256(deltaB));
            LibShipping.ship(uint256(deltaB));

            setSoilAbovePeg(s.sys.fields[s.sys.activeField].harvestable - priorHarvestable, caseId);
            s.sys.season.abovePeg = true;
        }
        // Below peg
        else {
            setSoil(uint256(-deltaB));
            s.sys.season.abovePeg = false;
        }
    }

    //////////////////// SET SOIL ////////////////////

    /**
     * @param newHarvestable The number of Beans that were minted to the Field.
     * @param caseId The current Weather Case.
     * @dev When above peg, Beanstalk wants to gauge demand for Soil. Here it
     * issues the amount of Soil that would result in the same number of Pods
     * as became Harvestable during the last Season.
     *
     * When the Pod Rate is high, Beanstalk issues less Soil.
     * When the Pod Rate is low, Beanstalk issues more Soil.
     */
    function setSoilAbovePeg(uint256 newHarvestable, uint256 caseId) internal {
        uint256 newSoil = newHarvestable.mul(100).div(100 + s.sys.weather.temp);
        if (caseId.mod(36) >= 24) {
            newSoil = newSoil.mul(SOIL_COEFFICIENT_HIGH).div(C.PRECISION); // high podrate
        } else if (caseId.mod(36) < 8) {
            newSoil = newSoil.mul(SOIL_COEFFICIENT_LOW).div(C.PRECISION); // low podrate
        }
        setSoil(newSoil);
    }

    function setSoil(uint256 amount) internal {
        s.sys.soil = amount.toUint128();
        emit Soil(s.sys.season.current, amount.toUint128());
    }
}
