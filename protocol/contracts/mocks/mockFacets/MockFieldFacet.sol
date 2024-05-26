/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {LibPRBMathRoundable} from "contracts/libraries/LibPRBMathRoundable.sol";
import "contracts/libraries/LibRedundantMath256.sol";
import "contracts/beanstalk/field/FieldFacet.sol";

/**
 * @author Publius, Brean
 * @title Mock Field Facet
 **/
contract MockFieldFacet is FieldFacet {
    using LibPRBMathRoundable for uint256;
    using LibRedundantMath256 for uint256;
    using LibRedundantMath128 for uint128;

    function incrementTotalSoilE(uint128 amount) external {
        s.sys.soil += amount;
    }

    function incrementTotalHarvestableE(uint256 fieldId, uint256 amount) external {
        C.bean().mint(address(this), amount);
        s.sys.fields[fieldId].harvestable += amount;
    }

    function incrementTotalPodsE(uint256 fieldId, uint256 amount) external {
        s.sys.fields[fieldId].pods += amount;
    }

    function totalRealSoil() external view returns (uint256) {
        return s.sys.soil;
    }

    function beanSown() external view returns (uint256) {
        return s.sys.beanSown;
    }

    /**
     * @dev used for testing purposes - refactor field facet upon next field deployment,
     * to avoid duplicate code.
     */
    function mockGetMorningTemp(
        uint256 initalTemp,
        uint256 delta
    ) external pure returns (uint256 scaledTemperature) {
        // check most likely case first
        if (delta > 24) {
            return uint256(initalTemp).mul(LibDibbler.TEMPERATURE_PRECISION);
        }

        // Binary Search
        if (delta < 13) {
            if (delta < 7) {
                if (delta < 4) {
                    if (delta < 2) {
                        // delta == 0, same block as sunrise
                        if (delta < 1) {
                            return LibDibbler.TEMPERATURE_PRECISION;
                        }
                        // delta == 1
                        else {
                            return _scaleTemperature(279415312704, initalTemp);
                        }
                    }
                    if (delta == 2) {
                        return _scaleTemperature(409336034395, initalTemp);
                    } else {
                        // delta == 3
                        return _scaleTemperature(494912626048, initalTemp);
                    }
                }
                if (delta < 6) {
                    if (delta == 4) {
                        return _scaleTemperature(558830625409, initalTemp);
                    } else {
                        // delta == 5
                        return _scaleTemperature(609868162219, initalTemp);
                    }
                } else {
                    // delta == 6
                    return _scaleTemperature(652355825780, initalTemp);
                }
            }
            if (delta < 10) {
                if (delta < 9) {
                    if (delta == 7) {
                        return _scaleTemperature(688751347100, initalTemp);
                    } else {
                        // delta == 8
                        return _scaleTemperature(720584687295, initalTemp);
                    }
                } else {
                    // delta == 9
                    return _scaleTemperature(748873234524, initalTemp);
                }
            }
            if (delta < 12) {
                if (delta == 10) {
                    return _scaleTemperature(774327938752, initalTemp);
                } else {
                    // delta == 11
                    return _scaleTemperature(797465225780, initalTemp);
                }
            } else {
                // delta == 12
                return _scaleTemperature(818672068791, initalTemp);
            }
        }
        if (delta < 19) {
            if (delta < 16) {
                if (delta < 15) {
                    if (delta == 13) {
                        return _scaleTemperature(838245938114, initalTemp);
                    } else {
                        // delta == 14
                        return _scaleTemperature(856420437864, initalTemp);
                    }
                } else {
                    // delta == 15
                    return _scaleTemperature(873382373802, initalTemp);
                }
            }
            if (delta < 18) {
                if (delta == 16) {
                    return _scaleTemperature(889283474924, initalTemp);
                } else {
                    // delta == 17
                    return _scaleTemperature(904248660443, initalTemp);
                }
            } else {
                // delta == 18
                return _scaleTemperature(918382006208, initalTemp);
            }
        }
        if (delta < 22) {
            if (delta < 21) {
                if (delta == 19) {
                    return _scaleTemperature(931771138485, initalTemp);
                } else {
                    // delta == 20
                    return _scaleTemperature(944490527707, initalTemp);
                }
            } else {
                // delta = 21
                return _scaleTemperature(956603996980, initalTemp);
            }
        }
        if (delta <= 23) {
            if (delta == 22) {
                return _scaleTemperature(968166659804, initalTemp);
            } else {
                // delta == 23
                return _scaleTemperature(979226436102, initalTemp);
            }
        } else {
            // delta == 24
            return _scaleTemperature(989825252096, initalTemp);
        }
    }

    function _scaleTemperature(
        uint256 pct,
        uint256 initalTemp
    ) private pure returns (uint256 scaledTemperature) {
        scaledTemperature = Math.max(
            // To save gas, `pct` is pre-calculated to 12 digits. Here we
            // perform the following transformation:
            // (1e2)    maxTemperature
            // (1e12)    * pct
            // (1e6)     / TEMPERATURE_PRECISION
            // (1e8)     = scaledYield
            initalTemp.mulDiv(
                pct,
                LibDibbler.TEMPERATURE_PRECISION,
                LibPRBMathRoundable.Rounding.Up
            ),
            // Floor at TEMPERATURE_PRECISION (1%)
            LibDibbler.TEMPERATURE_PRECISION
        );
    }

    /**
     * @notice allows for sowing specific amount of soil at temp
     */
    function mockSow(
        uint256 beans,
        uint256 _morningTemperature,
        uint32 maxTemperature,
        bool abovePeg
    ) external returns (uint256 pods) {
        s.sys.weather.temp = maxTemperature;
        pods = LibDibbler.sow(beans, _morningTemperature, msg.sender, abovePeg);
        return pods;
    }

    /**
     * @notice returns the total soil at a certain morning temperature.
     */
    function totalSoilAtMorningTemp(
        uint256 morningTemperature
    ) external view returns (uint256 totalSoil) {
        // Above peg: Soil is dynamic
        return
            LibDibbler.scaleSoilUp(
                uint256(s.sys.soil), // min soil
                uint256(s.sys.weather.temp).mul(LibDibbler.TEMPERATURE_PRECISION), // max temperature
                morningTemperature // temperature adjusted by number of blocks since Sunrise
            );
    }

    function setMaxTemp(uint32 t) external {
        s.sys.weather.temp = t;
    }
}
