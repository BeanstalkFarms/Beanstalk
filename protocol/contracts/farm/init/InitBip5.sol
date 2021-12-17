/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip5 runs the code for BIP-5.
**/

interface IBS {
    function createFundraiser(address fundraiser, address token, uint256 amount) external;
}

contract InitBip5 {
    address private constant payee = address(0x925753106FCdB6D2f30C3db295328a0A1c5fD1D1);
    address private constant token = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address private constant bean = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    
    function init() external {
        IBS(address(this)).createFundraiser(payee, token, 140000000000);
        IBean(address(bean)).mint(payee, 15000000000);
    }
}