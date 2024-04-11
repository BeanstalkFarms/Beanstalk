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

    // put this in a struct
    struct ReservesData {
        uint256[] instantaneousReserves;
        uint256[] cumulativeReserves;
        uint256[] cappedReserves;
    }

    mapping(address => ReservesData) reservesData;


    function setInstantaneousReserves(address well, uint[] memory _instantaneousReserves) external {
        console.log('setInstantaneousReserves well: ', well);
        reservesData[well].instantaneousReserves = _instantaneousReserves;
    }

    function readInstantaneousReserves(address well, bytes memory) external override view returns (uint[] memory reserves) {
        console.log('readInstantaneousReserves well: ', well);
        return reservesData[well].instantaneousReserves;
    }

    function readCappedReserves(address well, bytes memory) external view returns (uint[] memory reserves) {
        console.log('readCappedReserves cappedReserves:');
        for (uint i = 0; i < reservesData[well].cappedReserves.length; i++) {
            console.log('readCappedReserves cappedReserves[i]: ', reservesData[well].cappedReserves[i]);
        }
        return reservesData[well].cappedReserves;
    }

    function update(address well, uint256[] memory _reserves, bytes memory data) external {
        _update(well, _reserves, data);
    }

    function _update(address well, uint256[] memory _reserves, bytes memory data) internal {
        console.log('updating pump');
        reservesData[well].instantaneousReserves = _reserves;
        reservesData[well].cumulativeReserves = _reserves;
        reservesData[well].cappedReserves = _reserves;


        console.log('updating all reserves:');
        for (uint i = 0; i < reservesData[well].cappedReserves.length; i++) {
            console.log('update cappedReserves[i]: ', reservesData[well].cappedReserves[i]);
        }
    }

    // this function gets called from the well, msg.sender is the well
    function update(uint256[] memory _reserves, bytes memory data) external {
        console.log('updating pump from the well');
        _update(msg.sender, _reserves, data);
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
        _cumulativeReserves = abi.encodePacked(reservesData[well].cumulativeReserves[0], reservesData[well].cumulativeReserves[1]);
    }
}
