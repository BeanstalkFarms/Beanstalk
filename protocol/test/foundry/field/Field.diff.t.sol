// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import { LibDibbler } from "~/libraries/LibDibbler.sol";
import { LibIncentive } from "~/libraries/LibIncentive.sol";
import { LibPRBMath } from "~/libraries/LibPRBMath.sol";

/**
 * @dev This is used to test {LibIncentive.fracExp} and 
 * {LibDibbler.morningAuction} functions using differential testing.
 * morningAuction is replicated here as it does not take inputs.
 */
contract FieldDiffTest is Test {
    using Strings for uint256;
    using LibPRBMath for uint256;
    using SafeMath for uint256;

    uint256 private constant TEMPERATURE_PRECISION = 1e6;

    function testDiff_fracExp(uint256 baseReward, uint256 blocksLate) public {
        vm.assume(blocksLate < 30);
        // max base reward is 100 beans
        vm.assume(baseReward < 100e6);

        string[] memory cmds = new string[](7);
        cmds[0] = "python3";
        cmds[1] = "test/foundry/field/auction-math.py";
        cmds[2] = "fracExp";
        cmds[3] = "--input_1";
        cmds[4] = uint256(baseReward).toString();
        cmds[5] = "--input_2";
        cmds[6] = uint256(blocksLate).toString();

        bytes memory data = vm.ffi(cmds);
        uint256 calculatedAns = abi.decode(data, (uint256));
        uint256 actualAns = LibIncentive.fracExp(baseReward, blocksLate);

        assertEq(actualAns, calculatedAns, "fracExp failed");
    }
    function testDiff_morningAuction(uint32 t, uint256 deltaBlocks) public {
        vm.assume(deltaBlocks < 30);

        string[] memory cmds = new string[](7);
        cmds[0] = "python3";
        cmds[1] = "test/foundry/field/auction-math.py";
        cmds[2] = "morningAuctionLog";
        cmds[3] = "--input_1";
        cmds[4] = uint256(t).toString();
        cmds[5] = "--input_2";
        cmds[6] = uint256(deltaBlocks).toString();
        
        bytes memory data = vm.ffi(cmds);
        uint256 calculatedAns = abi.decode(data, (uint256));
        uint256 actualAns = morningTemperature(t, deltaBlocks);
        assertEq(actualAns, calculatedAns, "morniAuction failed");

    }

    /**
     * @dev this copies the logic from {LibDibbler.morningTemperature()},
     * but allows us to set the temperature and block delta
     */
    function morningTemperature(uint32 t, uint256 delta) internal pure returns (uint256 _morningTemperature) {
        // check most likely case first
        if (delta > 24) {
            return uint256(t).mul(TEMPERATURE_PRECISION);
        }

        // Binary Search
        if (delta < 13) {
            if (delta < 7) { 
                if (delta < 4) {
                    if (delta < 2) {
                        // delta == 0, same block as sunrise
                        if (delta < 1) {
                            return TEMPERATURE_PRECISION;
                        }
                        // delta == 1
                        else {
                            return _scaleTemperature(t, 279415312704);
                        }
                    }
                    if (delta == 2) {
                       return _scaleTemperature(t, 409336034395);
                    }
                    else { // delta == 3
                        return _scaleTemperature(t, 494912626048);
                    }
                }
                if (delta < 6) {
                    if (delta == 4) {
                        return _scaleTemperature(t, 558830625409);
                    }
                    else { // delta == 5
                        return _scaleTemperature(t, 609868162219);
                    }
                }
                else { // delta == 6
                    return _scaleTemperature(t, 652355825780); 
                }
            }
            if (delta < 10) {
                if (delta < 9) {
                    if (delta == 7) {
                        return _scaleTemperature(t, 688751347100);
                    }
                    else { // delta == 8
                        return _scaleTemperature(t, 720584687295);
                    }
                }
                else { // delta == 9
                    return _scaleTemperature(t, 748873234524); 
                }
            }
            if (delta < 12) {
                if (delta == 10) {
                    return _scaleTemperature(t, 774327938752);
                }
                else { // delta == 11
                    return _scaleTemperature(t, 797465225780); 
                }
            }
            else { // delta == 12
                return _scaleTemperature(t, 818672068791); 
            }
        } 
        if (delta < 19){
            if (delta < 16) {
                if (delta < 15) {
                    if (delta == 13) {
                        return _scaleTemperature(t, 838245938114); 
                    }
                    else { // delta == 14
                        return _scaleTemperature(t, 856420437864);
                    }
                }
                else { // delta == 15
                    return _scaleTemperature(t, 873382373802);
                }
            }
            if (delta < 18) {
                if (delta == 16) {
                    return _scaleTemperature(t, 889283474924);
                }
                else { // delta == 17
                    return _scaleTemperature(t, 904248660443);
                }
            }
            return _scaleTemperature(t, 918382006208); // delta == 18
        }
        if (delta < 22) {
            if (delta < 21) {
                if (delta == 19) {
                    return _scaleTemperature(t, 931771138485); 
                }
                else { // delta == 20
                    return _scaleTemperature(t, 944490527707);
                }
            }
            return _scaleTemperature(t, 956603996980); // delta == 21
        }
        if (delta <= 23){ 
            if (delta == 22) {
                return _scaleTemperature(t, 968166659804);
            }
            else { // delta == 23
                return _scaleTemperature(t, 979226436102);
            }
        }
        else { // delta == 24
            return _scaleTemperature(t, 989825252096);
        }
    }

    function _scaleTemperature(uint32 t, uint256 pct) private pure returns (uint256 scaledTemperature) {
        uint256 maxTemperature = t;
        if(maxTemperature == 0) return 0; 
        return LibPRBMath.max(
            // To save gas, `pct` is pre-calculated to 12 digits. Here we
            // perform the following transformation:
            // (1e2)    maxTemperature                100%
            // (1e18)    * pct 
            // (1e12)     / TEMPERATURE_PRECISION      1%
            // (1e8)     = scaledYield 
            maxTemperature.mulDiv(
                pct, 
                TEMPERATURE_PRECISION,
                LibPRBMath.Rounding.Up
            ),
            // Floor at TEMPERATURE_PRECISION (1%)
            TEMPERATURE_PRECISION
        );
    }
}