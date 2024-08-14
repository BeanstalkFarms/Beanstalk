/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {C} from "contracts/C.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";

/**
 * @author Brean
 * @notice InitReseed reseeds Beanstalk.
 */
contract InitReseed {
    AppStorage internal s;

    event Reseed(uint256 timestamp);

    function init() external {
        s.sys.paused = false;

        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

        // set the start of the Season based on the number of seasons,
        // rounding down to the nearest hour.
        s.sys.season.start =
            ((s.sys.season.timestamp / s.sys.season.period) * s.sys.season.period) -
            (s.sys.season.period * s.sys.season.current);
        emit Reseed(block.timestamp);
    }
}
