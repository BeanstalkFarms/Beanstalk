/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, AppStorage} from "../LibAppStorage.sol";
import {SafeMath, C, LibMinting} from "./LibMinting.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {IBeanstalkWellFunction} from "contracts/interfaces/basin/IBeanstalkWellFunction.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibEthUsdOracle} from "contracts/libraries/Oracle/LibEthUsdOracle.sol";
import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";

/**
 * @title Well Minting Oracle Library
 * @notice Well Minting Oracle can be Checked or Captured to compute
 * the time weighted average Delta B since the last time the Oracle was Captured
 * for a given Well.
 *
 * @dev
 * The Oracle uses the Season timestamp stored in `s.season.timestamp` to determine how many seconds
 * it has been since the last Season instead of storing its own for efficiency purposes.
 * Each Capture stores the encoded cumulative reserves returned by the Pump in `s.wellOracleSnapshots[well]`.
 **/

library LibWellMinting {

    using SignedSafeMath for int256;

    /**
     * @notice Emitted when a Well Minting Oracle is captured.
     * @param season The season that the Well was captured.
     * @param well The Well that was captured.
     * @param deltaB The time weighted average delta B computed during the Oracle capture.
     * @param cumulativeReserves The encoded cumulative reserves that were snapshotted most by the Oracle capture.
     */
    event WellOracle(
        uint32 indexed season,
        address well,
        int256 deltaB,
        bytes cumulativeReserves
    );

    using SafeMath for uint256;

    //////////////////// CHECK ////////////////////

    /**
     * @dev Returns the time weighted average delta B in a given Well
     * since the last Sunrise.
     * @return deltaB The time weighted average delta B balance since the last `capture` call.
     */
    function check(
        address well
    ) external view returns (int256 deltaB) {
        bytes memory lastSnapshot = LibAppStorage
            .diamondStorage()
            .wellOracleSnapshots[well];
        // If the length of the stored Snapshot for a given Well is 0,
        // then the Oracle is not initialized.
        if (lastSnapshot.length > 0) {
            (deltaB, , , ) = twaDeltaB(well, lastSnapshot);
        }

        deltaB = LibMinting.checkForMaxDeltaB(deltaB);
    }

    //////////////////// CHECK ////////////////////

    /**
     * @dev Returns the time weighted average delta B in a given Well
     * since the last Sunrise and snapshots the current cumulative reserves.
     * @return deltaB The time weighted average delta B balance since the last `capture` call.
     */
    function capture(
        address well
    ) external returns (int256 deltaB) {
        bytes memory lastSnapshot = LibAppStorage
            .diamondStorage()
            .wellOracleSnapshots[well];
        // If the length of the stored Snapshot for a given Well is 0,
        // then the Oracle is not initialized.
        if (lastSnapshot.length > 0) {
            deltaB = updateOracle(well, lastSnapshot);
        } else {
            initializeOracle(well);
        }

        deltaB = LibMinting.checkForMaxDeltaB(deltaB);
    }

    //////////////////// Oracle ////////////////////

    /**
     * Initializes the Well Minting Oracle for a given Well by snapshotting the current
     * encoded cumulative reserves from a Beanstalk supported pump.
     */
    function initializeOracle(address well) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // If pump has not been initialized for `well`, `readCumulativeReserves` will revert. 
        // Need to handle failure gracefully, so Sunrise does not revert.
        Call[] memory pumps = IWell(well).pumps();
        try ICumulativePump(pumps[0].target).readCumulativeReserves(
            well,
            pumps[0].data
        ) returns (bytes memory lastSnapshot) {
            s.wellOracleSnapshots[well] = lastSnapshot;
            emit WellOracle(s.season.current, well, 0, lastSnapshot);
        } catch {
            emit WellOracle(s.season.current, well, 0, new bytes(0));
        }
    }

    /**
     * @dev Updates the Oracle snapshot for a given Well and returns the deltaB
     * given the previous snapshot in the Well
     */
    function updateOracle(
        address well,
        bytes memory lastSnapshot
    ) internal returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256[] memory twaReserves;
        uint256[] memory ratios;
        (deltaB, s.wellOracleSnapshots[well], twaReserves, ratios) = twaDeltaB(
            well,
            lastSnapshot
        );

        // Set the Well reserves in storage, so that it can be read when
        // 1) set the USD price of the non bean token so that it can be read when
        //    calculating the price of Bean. See {LibEvaluate.evalPrice}.
        // 2) When calculating the Bean reward for calling the Season (Bean:Eth Only).
        //    See {LibIncentive.determineReward}.
        LibWell.setTwaReservesForWell(well, twaReserves);
        LibWell.setUsdTokenPriceForWell(well, ratios);

        emit WellOracle(
            s.season.current,
            well,
            deltaB,
            s.wellOracleSnapshots[well]
        );
    }
    
    /**
     * @dev Calculates the delta B of a given well for a given set of well state parameters.
     * Designed to work for instantaneous and twa delta B calculations.
     */
    function getDeltaBInfo(address well, uint[] memory reserves, bytes memory snapshot, uint256 lookback
    ) internal view returns (int256, bytes memory, uint256[] memory, uint256[] memory) {

        // get well tokens
        IERC20[] memory tokens = IWell(well).tokens();
        (
            uint256[] memory ratios,
            uint256 beanIndex,
            bool success
        ) = LibWell.getRatiosAndBeanIndex(tokens, lookback);

        // If the Bean reserve is less than the minimum, the minting oracle should be considered off.
        if (reserves[beanIndex] < C.WELL_MINIMUM_BEAN_BALANCE) {
            return (0, snapshot, new uint256[](0), new uint256[](0));
        }

        // If the USD Oracle oracle call fails, the minting oracle should be considered off.
        if (!success) {
            return (0, snapshot, reserves, new uint256[](0));
        }

        int256 deltaB = calculateDeltaBAtBeanIndex(well, reserves, ratios, beanIndex);

        return (deltaB, snapshot, reserves, ratios);    
    }

    /**
     * @dev Calculates the delta B at a given Bean index for a given Well address
     * based on the current well reserves, well ratios and well function.
     */
    function calculateDeltaBAtBeanIndex(address well, uint[] memory reserves, uint256[] memory ratios, uint256 beanIndex
    ) internal view returns (int256) {
        Call memory wellFunction = IWell(well).wellFunction();
        return int256(IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioSwap(
            reserves,
            beanIndex,
            ratios,
            wellFunction.data
        )).sub(int256(reserves[beanIndex]));
    }

    /**
     * @dev Calculates the time weighted average delta B since the input snapshot for
     * a given Well address.
     */
    function twaDeltaB(
        address well,
        bytes memory lastSnapshot
    ) internal view returns (int256, bytes memory, uint256[] memory, uint256[] memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Try to call `readTwaReserves` and handle failure gracefully, so Sunrise does not revert.
        // On failure, reset the Oracle by returning an empty snapshot and a delta B of 0.
        Call[] memory pumps = IWell(well).pumps();
        try ICumulativePump(pumps[0].target).readTwaReserves(
            well,
            lastSnapshot,
            uint40(s.season.timestamp),
            pumps[0].data
        ) returns (uint[] memory twaReserves, bytes memory snapshot) {
                                // well, reserves, snapshot  lookback
            return (getDeltaBInfo(well, twaReserves, snapshot, block.timestamp.sub(s.season.timestamp)));
        }
        catch {
            // if the pump fails, return all 0s to avoid the sunrise reverting.
            return (0, new bytes(0), new uint256[](0), new uint256[](0));
        }
    }

    /**
     * @dev Calculates the instantaneous delta B for a given Well address.
     * @param well The address of the Well.
     * @return deltaB The instantaneous delta B balance since the last `capture` call.
     */
    function instantaneousDeltaB(address well) internal view returns (int256) {
        Call[] memory pumps = IWell(well).pumps();
                                                                                            // well address , data[]
        uint[] memory instReserves = IInstantaneousPump(pumps[0].target).readInstantaneousReserves(well, pumps[0].data);
                                                                    // well, reserves, snapshot, lookback
        (int256 deltaB, , ,) = getDeltaBInfo(well, instReserves, new bytes(0) , 0);
        return (deltaB);
    }

}
