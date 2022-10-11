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
        0x735CAB9B02Fd153174763958FFb4E0a971DD7f29;
    uint256 private constant payment = 10_000 * 1e6; // 10,000 Beans

    function init() external {
        IBean(C.bean()).mint(rootAddress, payment);
    }
}
