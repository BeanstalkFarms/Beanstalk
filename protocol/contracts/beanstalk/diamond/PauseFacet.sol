/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title Pause Facet handles the pausing/unpausing of Beanstalk.
 **/
contract PauseFacet {
    AppStorage internal s;

    event Pause(uint256 timestamp);
    event Unpause(uint256 timestamp, uint256 timePassed);

    /**
     * Pause / Unpause
     **/

    function pause() external payable {
        LibDiamond.enforceIsOwnerOrContract();
        require(!s.paused, "Pause: already paused.");
        s.paused = true;
        s.co.initialized = false;
        s.pausedAt = uint128(block.timestamp);
        emit Pause(block.timestamp);
    }

    function unpause() external payable {
        LibDiamond.enforceIsOwnerOrContract();
        require(s.paused, "Pause: not paused.");
        s.paused = false;
        uint256 timePassed = block.timestamp - s.pausedAt;
        timePassed = (timePassed / 3600 + 1) * 3600;
        s.season.start = s.season.start + timePassed;
        emit Unpause(block.timestamp, timePassed);
    }
}
