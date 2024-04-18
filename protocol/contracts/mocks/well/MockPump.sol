/**
 * SPDX-License-Identifier: MIT
 *
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";
import {ICumulativePump} from "contracts/interfaces/basin/pumps/ICumulativePump.sol";
import {console} from "forge-std/console.sol";

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

    function setInstantaneousReserves(
        address well, 
        uint[] memory _instantaneousReserves
    ) external {
        reservesData[well].instantaneousReserves = _instantaneousReserves;
    }

    function readInstantaneousReserves(address well, bytes memory) external override view returns (uint[] memory reserves) {
        return reservesData[well].instantaneousReserves;
    }

    function readCappedReserves(address well, bytes memory) external view returns (uint[] memory reserves) {
        return reservesData[well].cappedReserves;
    }

    function update(address well, uint256[] memory _reserves, bytes memory data) external {
        _update(well, _reserves, data);
    }

    function update(uint256[] memory _reserves, bytes memory data) external {
        _update(msg.sender, _reserves, data);
    }

    function _update(address well, uint256[] memory _reserves, bytes memory) internal {
        reservesData[well].instantaneousReserves = _reserves;
        reservesData[well].cumulativeReserves = _reserves;
        reservesData[well].cappedReserves = _reserves;
    }

    function setCumulativeReserves(address well, uint[] memory _cumulativeReserves) external {
        reservesData[well].cumulativeReserves = _cumulativeReserves;
    }

    function readCumulativeReserves(
        address well,
        bytes memory
    ) external override view returns (bytes memory) {
        return abi.encodePacked(reservesData[well].cumulativeReserves[0], reservesData[well].cumulativeReserves[1]);
    }

    function readTwaReserves(
        address well,
        bytes calldata,
        uint,
        bytes memory
    ) external override view returns (uint[] memory twaReserves, bytes memory _cumulativeReserves){
        twaReserves = reservesData[well].cumulativeReserves;
        _cumulativeReserves = abi.encodePacked(twaReserves[0], twaReserves[1]);
    }

    function clearReserves(address well) external {
        delete reservesData[well];
    }
}
