/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author 0xm00neth
 * @title Mock Contract which checks external function approval
 **/
contract MockChecker {
    bool approve;

    function setApprove(bool _approve) external {
        approve = _approve;
    }

    function check(
        address,
        bytes calldata,
        bytes calldata,
        bytes calldata _stateData
    ) external view returns (bytes memory) {
        return abi.encode(approve, _stateData);
    }
}
