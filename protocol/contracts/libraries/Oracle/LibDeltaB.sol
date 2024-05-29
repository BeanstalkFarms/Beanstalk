// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibWellMinting} from "../Minting/LibWellMinting.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibWell} from "../Well/LibWell.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {ICappedReservesPump} from "contracts/interfaces/basin/pumps/ICappedReservesPump.sol";
import {IBeanstalkWellFunction} from "contracts/interfaces/basin/IBeanstalkWellFunction.sol";

/**
 * @title LibPipelineConvert
 * @author pizzaman1337, Brean
 */

library LibDeltaB {
    using LibRedundantMath256 for uint256;
    using LibRedundantMathSigned256 for int256;

    uint256 internal constant ZERO_LOOKBACK = 0;

    /**
     * @param token The token to get the deltaB of.
     * @return The deltaB of the token, for Bean it returns 0.
     */
    function getCurrentDeltaB(address token) internal view returns (int256) {
        if (token == C.BEAN) {
            return 0;
        }

        int256 deltaB = LibDeltaB.currentDeltaB(token);
        return deltaB;
    }

    /**
     * @dev Calculates the current deltaB for a given Well address.
     * @param well The address of the Well.
     * @return The current deltaB uses the current reserves in the well.
     */
    function currentDeltaB(address well) internal view returns (int256) {
        uint256[] memory reserves = IWell(well).getReserves();
        return calculateDeltaBFromReserves(well, reserves, ZERO_LOOKBACK);
    }

    /**
     * @notice returns the overall current deltaB for all whitelisted well tokens.
     */
    function overallCurrentDeltaB() internal view returns (int256 deltaB) {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            int256 wellDeltaB = currentDeltaB(tokens[i]);
            deltaB = deltaB.add(wellDeltaB);
        }
    }

    /**
     * @notice returns the overall cappedReserves deltaB for all whitelisted well tokens.
     */
    function cappedReservesDeltaB(address well) internal view returns (int256) {
        if (well == C.BEAN) {
            return 0;
        }

        // get first pump from well
        Call[] memory pumps = IWell(well).pumps();
        address pump = pumps[0].target;

        // well address , data[]
        uint256[] memory instReserves = ICappedReservesPump(pump).readCappedReserves(
            well,
            pumps[0].data
        );

        // calculate deltaB.
        return calculateDeltaBFromReserves(well, instReserves, ZERO_LOOKBACK);
    }

    // Calculates overall deltaB, used by convert for stalk penalty purposes
    function overallCappedDeltaB() internal view returns (int256 deltaB) {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            int256 cappedDeltaB = cappedReservesDeltaB(tokens[i]);
            deltaB = deltaB.add(cappedDeltaB);
        }
    }

    /**
     * @notice returns the LP supply for each whitelisted well
     */
    function getLpSupply() internal view returns (uint256[] memory lpSupply) {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        lpSupply = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            lpSupply[i] = IERC20(tokens[i]).totalSupply();
        }
    }

    /**
     * @notice returns the overall instantaneous deltaB for all whitelisted well tokens,
     * scaled by the change in LP supply.
     * @dev used in pipelineConvert.
     */
    function scaledOverallCurrentDeltaB(
        uint256[] memory lpSupply
    ) internal view returns (int256 deltaB) {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == C.BEAN) continue;
            int256 wellDeltaB = scaledCurrentDeltaB(tokens[i], lpSupply[i]);
            deltaB = deltaB.add(wellDeltaB);
        }
    }

    function scaledCurrentDeltaB(
        address well,
        uint256 lpSupply
    ) internal view returns (int256 wellDeltaB) {
        wellDeltaB = currentDeltaB(well);
        wellDeltaB = scaledDeltaB(lpSupply, IERC20(well).totalSupply(), wellDeltaB);
    }

    /*
     * @notice returns the scaled deltaB, based on LP supply before and after convert
     */
    function scaledDeltaB(
        uint256 beforeLpTokenSupply,
        uint256 afterLpTokenSupply,
        int256 deltaB
    ) internal pure returns (int256) {
        return deltaB.mul(int256(beforeLpTokenSupply)).div(int(afterLpTokenSupply));
    }

    /**
     * @notice calculates the deltaB for a given well using the reserves.
     * @dev reverts if the bean reserve is less than the minimum,
     * or if the usd oracle fails.
     * This differs from the twaDeltaB, as this function should not be used within the sunrise function.
     */
    function calculateDeltaBFromReserves(
        address well,
        uint256[] memory reserves,
        uint256 lookback
    ) internal view returns (int256) {
        IERC20[] memory tokens = IWell(well).tokens();
        Call memory wellFunction = IWell(well).wellFunction();

        (uint256[] memory ratios, uint256 beanIndex, bool success) = LibWell.getRatiosAndBeanIndex(
            tokens,
            lookback
        );

        // Converts cannot be performed, if the Bean reserve is less than the minimum
        if (reserves[beanIndex] < C.WELL_MINIMUM_BEAN_BALANCE) {
            revert("Well: Bean reserve is less than the minimum");
        }

        // If the USD Oracle call fails, a deltaB cannot be determined.
        if (!success) {
            revert("Well: USD Oracle call failed");
        }

        return
            int256(
                IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioSwap(
                    reserves,
                    beanIndex,
                    ratios,
                    wellFunction.data
                )
            ).sub(int256(reserves[beanIndex]));
    }
}
