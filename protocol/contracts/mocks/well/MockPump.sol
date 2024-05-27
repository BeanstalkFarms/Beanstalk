/**
 * SPDX-License-Identifier: MIT
 *
 */

pragma solidity ^0.8.20;

import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";

/**
 * @title Mock Pump
 */

contract MockPump is IInstantaneousPump, ICumulativePump {
    struct ReservesData {
        uint256[] instantaneousReserves;
        uint256[] cumulativeReserves;
        uint256[] cappedReserves;
    }

    mapping(address => ReservesData) reservesData;

    function setInstantaneousReserves(address well, uint[] memory _instantaneousReserves) external {
        reservesData[well].instantaneousReserves = _instantaneousReserves;
    }

    function readInstantaneousReserves(
        address well,
        bytes memory
    ) external view override returns (uint[] memory reserves) {
        return reservesData[well].instantaneousReserves;
    }

    function readCappedReserves(
        address well,
        bytes memory
    ) external view returns (uint[] memory reserves) {
        return reservesData[well].cappedReserves;
    }

    function update(address well, uint256[] memory _reserves, bytes memory data) external {
        _update(well, _reserves, data);
    }

    function updateNoBytes(address well, uint256[] memory _reserves) external {
        _update(well, _reserves, new bytes(0));
    }

    function _update(address well, uint256[] memory _reserves, bytes memory data) internal {
        reservesData[well].instantaneousReserves = _reserves;
        reservesData[well].cumulativeReserves = _reserves;
        reservesData[well].cappedReserves = _reserves;
    }

    // this function gets called from the well, msg.sender is the well
    function update(uint256[] memory _reserves, bytes memory data) external {
        _update(msg.sender, _reserves, data);
    }

    function setCumulativeReserves(address well, uint[] memory _cumulativeReserves) external {
        reservesData[well].cumulativeReserves = _cumulativeReserves;
    }

    function readCumulativeReserves(
        address well,
        bytes memory
    ) external view override returns (bytes memory) {
        return
            abi.encodePacked(
                reservesData[well].cumulativeReserves[0],
                reservesData[well].cumulativeReserves[1]
            );
    }

    function readTwaReserves(
        address well,
        bytes calldata,
        uint,
        bytes memory
    ) external view override returns (uint[] memory twaReserves, bytes memory _cumulativeReserves) {
        twaReserves = reservesData[well].cumulativeReserves;
        _cumulativeReserves = abi.encodePacked(twaReserves[0], twaReserves[1]);
    }

    function clearReserves(address well) external {
        delete reservesData[well];
    }
}
