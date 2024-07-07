// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibMigrateIn
 * @author funderbrker
 * @notice Library handling inbound migration and minting of protocol assets.
 */
library LibMigrateIn {
    // Definitions must match source migration definitions. May require multiple definitions.
    struct SourceDeposit {}
    struct SourcePlot {}

    struct SourceFertilizer {
        uint128 id;
        uint256 amount;
        uint256 _unfertilizedBpf;
    }

    // Mint assets locally.
    // Underlying external ERC20s have already been transferred to destination beanstalk.
    // msg.sender == source instance
    function migrateInDeposits(address user, bytes[] deposits) internal;

    function migrateInPlots(address user, bytes[] plots) internal;

    /**
     * @notice Mint equivalent fertilizer to the user such that they retain all remaining BPF.
     */
    function migrateInFertilizer(address user, bytes[] fertilizer) internal {
        for (uint256 i = 0; i < fertilizer.length; i++) {
            SourceFertilizer memory sourceFert = abi.decode(fertilizer[i], (SourceFertilizer));

            // Update Beanstalk state and mint Fert to user. Bypasses standard minting calcs.
            LibFertilizer.IncrementFertState(sourceFert.amount, sourceFert._unfertilizedBpf);
            C.fertilizer().beanstalkMint(
                user,
                s.sys.fert.bpf + _unfertilizedBpf,
                amount.toUint128(),
                s.sys.fert.bpf
            );
        }
    }
}
