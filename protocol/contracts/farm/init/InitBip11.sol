/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitBip11 runs the code for BIP-11.
**/

contract InitBip11 {

    AppStorage internal s;

    address private constant BEAN_ADDRESS = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    
    address private constant PUBLIUS_ADDRESS = address(0x925753106FCdB6D2f30C3db295328a0A1c5fD1D1);
    uint256 private constant PAYMENT = 4000000000;

    address private constant DUMPLING_ADDRESS = address(0x96CF76Eaa90A79f8a69893de24f1cB7DD02d07fb);
    uint256 private constant DUMPLING_PAYMENT = 1000000000;

    function init() external {
        IBean(BEAN_ADDRESS).mint(PUBLIUS_ADDRESS, PAYMENT);
        IBean(BEAN_ADDRESS).mint(DUMPLING_ADDRESS, DUMPLING_PAYMENT);
    }
}