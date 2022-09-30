//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

interface IPipeline {
    struct Pipe {
        address target;
        bytes data;
    }

    function pipe(Pipe calldata p)
        external
        payable
        returns (bytes memory result);

    function pipeMulti(Pipe[] calldata pipes)
        external
        payable
        returns (bytes[] memory results);

    struct EtherPipe {
        address target;
        bytes data;
        uint256 value;
    }

    function pipeEther(EtherPipe calldata etherPipe)
        external
        payable
        returns (bytes memory result);


    struct ReturnPipe {
        address target;
        bytes preData;
        bytes postData;
    }

    function pipeReturn(Pipe calldata p, ReturnPipe calldata returnPipe)
        external
        payable
        returns (bytes[] memory results);

    struct EtherReturnPipe {
        address target;
        bytes preData;
        bytes postData;
        uint256 value;
    }


    function pipeEtherReturn(EtherPipe calldata etherPipe, EtherReturnPipe calldata etherReturnPipe)
        external
        payable
        returns (bytes[] memory results);

}
