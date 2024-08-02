/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip5 runs the code for BIP-5.
**/

contract InitBip7 {
    address private constant publius = address(0x925753106FCdB6D2f30C3db295328a0A1c5fD1D1);
    address private constant bean = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    uint256 private constant payment = 6_000_000_000; // 6,000
    
    function init() external {
        IBean(bean).mint(publius, payment);
    }
}