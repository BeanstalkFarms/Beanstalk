/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, AppStorage} from "../LibAppStorage.sol";
import {SafeMath, C, LibMinting} from "./LibMinting.sol";
import {IInstantaneousPump} from "@wells/interfaces/pumps/IInstantaneousPump.sol";
import {ICumulativePump} from "@wells/interfaces/pumps/ICumulativePump.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Call, IWell} from "@wells/interfaces/IWell.sol";
import {LibUsdOracle} from "~/libraries/Oracle/LibUsdOracle.sol";
import {LibWell} from "~/libraries/Well/LibWell.sol";
import {IBeanstalkWellFunction} from "@wells/interfaces/IBeanstalkWellFunction.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";

/**
 * @author Publius
 * @title Well Minting calculates the deltaB in a Well over a given Season.
 **/

library LibWellMinting {

    using SignedSafeMath for int256;
    
    bytes constant BYTES_ZERO = new bytes(0);

    int256 private constant mintPrecision = 100;
    uint256 private constant MAX_DELTA_B_DENOMINATOR = 100;

    event WellOracle(
        uint32 indexed season,
        address oracle,
        int256 deltaB,
        bytes balances
    );

    using SafeMath for uint256;

    function check(
        address well
    ) internal view returns (int256 deltaB) {
        deltaB = _check(well);
        deltaB = LibMinting.checkForMaxDeltaB(deltaB);
    }

    function _check(
        address well
    ) internal view returns (int256 deltaB) {
        bytes memory lastSnapshot = LibAppStorage
            .diamondStorage()
            .wellOracleSnapshots[well];
        if (lastSnapshot.length > 0) {
            (deltaB, ) = twaDeltaB(well, lastSnapshot);
        } else {
            deltaB = 0;
        }
    }

    function capture(
        address well
    ) internal returns (int256 deltaB) {
        deltaB = _capture(well);
        deltaB = LibMinting.checkForMaxDeltaB(deltaB);
    }

    function _capture(
        address well
    ) internal returns (int256 db) {
        bytes memory lastSnapshot = LibAppStorage
            .diamondStorage()
            .wellOracleSnapshots[well];
        if (lastSnapshot.length > 0) {
            db = updateOracle(well, lastSnapshot);
        } else {
            initializeOracle(well);
        }
    }

    function initializeOracle(address well) internal {
        // If pump has not been initialized for `well`, `readCumulativeReserves` will revert. 
        // Need to handle failure gracefully, so Sunrise does not revert.
        try ICumulativePump(LibWell.BEANSTALK_PUMP).readCumulativeReserves(
            well,
            BYTES_ZERO
        ) returns (bytes memory lastSnapshot) {
            LibAppStorage.diamondStorage().wellOracleSnapshots[well] = lastSnapshot;
        } catch {}
    }

    function updateOracle(
        address well,
        bytes memory lastSnapshot
    ) internal returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (deltaB, s.wellOracleSnapshots[well]) = twaDeltaB(
            well,
            lastSnapshot
        );
        emit WellOracle(
            s.season.current,
            well,
            deltaB,
            s.wellOracleSnapshots[well]
        );
    }

    function twaDeltaB(
        address well,
        bytes memory lastSnapshot
    ) internal view returns (int256 deltaB, bytes memory snapshot) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256[] memory twaBalances;
        (twaBalances, snapshot) = ICumulativePump(LibWell.BEANSTALK_PUMP)
            .readTwaReserves(well, lastSnapshot, uint40(s.season.timestamp), BYTES_ZERO);
        IERC20[] memory tokens = IWell(well).tokens();
        uint256 beanIndex;
        uint256[] memory ratios = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == C.bean()) {
                beanIndex = i;
                ratios[i] = 1e6;
            } else {
                ratios[i] = LibUsdOracle.getUsdPrice(address(tokens[i]));
            }
        }

        Call memory wellFunction = IWell(well).wellFunction();

        deltaB = int256(IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioSwap(
            twaBalances,
            beanIndex,
            ratios,
            wellFunction.data
        )).sub(int256(twaBalances[beanIndex]));
    }
}
