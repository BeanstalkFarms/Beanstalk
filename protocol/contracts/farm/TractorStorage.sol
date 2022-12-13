// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IDiamondCut.sol";

/**
 * @author 0xm00neth
 * @title Tractor Storage defines the state object for Tractor.
 **/

struct TractorStorage {
    mapping(bytes32 => uint256) blueprintNonce;
    address isTractorAndBlueprintPublisher;
}
