/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title Pause Facet handles the pausing/unpausing of Beanstalk.
 **/
contract PauseFacet {
    AppStorage internal s;

    using SafeMath for uint256;

    event Pause(uint256 timestamp);
    event Unpause(uint256 timestamp, uint256 timePassed);

    /**
     * Pause / Unpause
     **/

    function pause() external payable {
        LibDiamond.enforceIsOwnerOrContract();
        require(!s.paused, "Pause: already paused.");
        if (s.paused) return;
        s.paused = true;
        s.co.initialized = false;
        s.pausedAt = uint128(block.timestamp);
        emit Pause(block.timestamp);
    }

    function unpause() external payable {
        LibDiamond.enforceIsOwnerOrContract();
        require(s.paused, "Pause: not paused.");
        if (!s.paused) return;
        s.paused = false;
        uint256 timePassed = block.timestamp.sub(uint256(s.pausedAt));
        timePassed = (timePassed.div(3600).add(1)).mul(3600);
        s.season.start = s.season.start.add(timePassed);
        emit Unpause(block.timestamp, timePassed);
    }
}
