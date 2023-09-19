/**
 * SPDX-License-Identifier: MIT
 *
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";

/**
 * @title Mock Pump
 */

contract MockPump is IInstantaneousPump {

    uint[] instantaneousReserves;

    function setInstantaneousReserves(uint[] memory _instantaneousReserves) external {
        instantaneousReserves = _instantaneousReserves;
    }

    function readInstantaneousReserves(address, bytes memory) external override view returns (uint[] memory reserves) {
        return instantaneousReserves;
    }

    function update(uint256[] memory _reserves, bytes memory) external {
        instantaneousReserves = _reserves;
    }
}
