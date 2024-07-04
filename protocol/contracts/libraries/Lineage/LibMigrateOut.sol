// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibMigrateOut
 * @author funderbrker
 * @notice Library handling outbound migration and burning of protocol assets.
 */
library LibMigrateOut {
    // Need to define structs locally to contain additional migration information.
    struct Deposit {}
    struct Plot {}
    struct Fertilizer {
        uint128 id;
        uint256 amount;
        uint256 unfertilizedBpf;
    }

    /**
     * @notice Sends underlying assets and burns deposits according to this fork's configuration.
     * @return The set of deposits to migrate, encoded as bytes.
     */
    function migrateOutDeposits() internal returns (bytes[] deposits);

    /**
     * @notice Burns plots, according to this fork's configuration.
     * @return The plots to migrate, encoded as bytes.
     */
    function migrateOutPlots() internal returns (bytes[] plots);

    /**
     * @notice Burns Fertilizer, according to this fork's configuration.
     * @return The Fertilizer to migrate, encoded as bytes.
     */
    function migrateOutFertilizer(ids, mode) internal returns (bytes[] fertilizer) {
        fertilizer = bytes[](ids.length);

        /*
        0. Update user
        1. Decrement s.sys.fert.activeFertilizer
        2. Decrement s.sys.fert.fertilizer[id]
        3. Decrement s.sys.fert.unfertilizedIndex
        4. Check leftoverBeans
        */

        LibFertilizer.claimFertilized(ids, mode);

        (
            uint256[] memory fertilizer,
            uint256 totalFertilizer,
            uint256[] remainingBpf,
            uint256 totalUnfertilized
        ) = LibFertilizer.getAmountsOfIds(account, ids);

        s.sys.fert.activeFertilizer -= totalFertilizer;
        s.sys.fert.unfertilizedIndex -= totalUnfertilized;
        for (uint256 i; i < ids.length; i++) {
            s.sys.fert.fertilizer[id] -= fertilizer[id];
            fertilizer[i] = abi.encode(Fertilizer(ids[i], idBalances[i], remainingBpf[i]));
        }

        // If leftover beans are greater than obligations, drop excess leftovers.
        uint256 unfertilizedBeans = s.sys.fert.unfertilizedIndex - s.sys.fert.fertilizedIndex;
        if (unfertilizedBeans > s.sys.fert.leftoverBeans) {
            s.sys.fert.leftoverBeans = unfertilizedBeans;
        }
    }
}
