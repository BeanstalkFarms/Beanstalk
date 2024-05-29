/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {AppStorage} from "../storage/AppStorage.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";

/**
 * @author Publius
 * @title Pause Facet handles the pausing/unpausing of Beanstalk.
 **/
contract PauseFacet {
    AppStorage internal s;

    using LibRedundantMath256 for uint256;

    event Pause(uint256 timestamp);
    event Unpause(uint256 timestamp, uint256 timePassed);

    /**
     * Pause / Unpause
     **/

    function pause() external payable {
        LibDiamond.enforceIsOwnerOrContract();
        require(!s.sys.paused, "Pause: already paused.");
        s.sys.paused = true;
        s.sys.pausedAt = uint128(block.timestamp);
        emit Pause(block.timestamp);
    }

    function unpause() external payable {
        LibDiamond.enforceIsOwnerOrContract();
        require(s.sys.paused, "Pause: not paused.");
        s.sys.paused = false;
        uint256 timePassed = block.timestamp.sub(uint256(s.sys.pausedAt));
        timePassed = (timePassed.div(3600).add(1)).mul(3600);
        s.sys.season.start = s.sys.season.start.add(timePassed);
        emit Unpause(block.timestamp, timePassed);
    }
}
