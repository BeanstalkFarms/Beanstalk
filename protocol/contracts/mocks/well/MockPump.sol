/**
 * SPDX-License-Identifier: MIT
 *
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";

/**
 * @title Mock Pump
 */

contract MockPump is IInstantaneousPump, ICumulativePump {

    uint[] instantaneousReserves;
    uint[] cumulativeReserves;

    function setInstantaneousReserves(uint[] memory _instantaneousReserves) external {
        instantaneousReserves = _instantaneousReserves;
    }

    function readInstantaneousReserves(address, bytes memory) external override view returns (uint[] memory reserves) {
        return instantaneousReserves;
    }

    function update(uint256[] memory _reserves, bytes memory) external {
        instantaneousReserves = _reserves;
        cumulativeReserves = _reserves;
    }

    function setCumulativeReserves(uint[] memory _cumulativeReserves) external {
        cumulativeReserves = _cumulativeReserves;
    }
    function readCumulativeReserves(
        address,
        bytes memory
    ) external override view returns (bytes memory) {
        return abi.encodePacked(cumulativeReserves[0], cumulativeReserves[1]);
    }

    function readTwaReserves(
        address,
        bytes calldata,
        uint,
        bytes memory
    ) external override view returns (uint[] memory twaReserves, bytes memory _cumulativeReserves){
        twaReserves = cumulativeReserves;
        _cumulativeReserves = abi.encodePacked(cumulativeReserves[0], cumulativeReserves[1]);
    }
}
