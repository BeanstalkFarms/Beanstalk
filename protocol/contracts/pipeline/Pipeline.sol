//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPipeline.sol";
import "../libraries/LibFunction.sol";

contract Pipeline is IPipeline {

    function pipe(Pipe calldata p)
        external
        payable
        override
        returns (bytes memory result)
    {
        result = _pipe(p);
    }

    function pipeMulti(Pipe[] calldata pipes)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](pipes.length);
        for (uint256 i = 0; i < pipes.length; i++) {
            results[i] = _pipe(pipes[i]);
        }
    }

    function pipeEther(EtherPipe calldata etherPipe)
        external
        payable
        override
        returns (bytes memory result)
    {
        result = _pipeEther(etherPipe);
    }

    function pipeReturn(Pipe calldata p, ReturnPipe calldata returnPipe)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](2);
        results[0] = _pipe(p);
        results[1] = _pipeReturn(returnPipe, results[0]);
    }

    function pipeEtherReturn(EtherPipe calldata etherPipe, EtherReturnPipe calldata etherReturnPipe)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](2);
        results[0] = _pipeEther(etherPipe);
        results[1] = _pipeEtherReturn(etherReturnPipe, results[0]);
    }


    function _pipe(Pipe calldata p) internal returns (bytes memory result) {
        bool success;
        (success, result) = p.target.call(p.data);
        LibFunction.checkReturn(success, result);
    }

    function _pipeEther(EtherPipe calldata p) internal returns (bytes memory result) {
        bool success;
        (success, result) = p.target.call{value: p.value}(p.data);
        LibFunction.checkReturn(success, result);
    }

    function _pipeReturn(ReturnPipe calldata p, bytes memory returnData) internal returns (bytes memory result) {
        bool success;
        (success, result) = p.target.call(abi.encode(p.preData, returnData, p.postData));
        LibFunction.checkReturn(success, result);
    }

    function _pipeEtherReturn(EtherReturnPipe calldata p, bytes memory returnData) internal returns (bytes memory result) {
        bool success;
        (success, result) = p.target.call{value: p.value}(abi.encode(p.preData, returnData, p.postData));
        LibFunction.checkReturn(success, result);
    }
}
