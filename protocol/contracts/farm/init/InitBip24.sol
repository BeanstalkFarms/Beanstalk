/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

/**
 * @author Publius
 * @title InitBip24 runs the code for BIP-24. 
 **/
contract InitBip24 {
    address private constant rootAddress =
        0x735cab9b02fd153174763958ffb4e0a971dd7f29;
    function init() external {
        IBean(C.bean()).mint(rootAddress, 10_000 * 1e6);
    }
}
