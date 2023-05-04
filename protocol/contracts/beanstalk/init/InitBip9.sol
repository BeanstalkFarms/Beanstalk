/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8.
**/

contract InitBip9 {

    AppStorage internal s;
    
    address private constant PUBLIUS_ADDRESS = address(0x925753106FCdB6D2f30C3db295328a0A1c5fD1D1);
    address private constant BEAN_ADDRESS = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    uint256 private constant PAYMENT = 6000000000;

    address private constant BROKEN_ADDRESS = address(0x0b8e605A7446801ae645e57de5AAbbc251cD1e3c);

    function init() external {
        s.season.withdrawSeasons = 25;
        s.a[BROKEN_ADDRESS].lastRain = 0;

        IBean(BEAN_ADDRESS).mint(PUBLIUS_ADDRESS, PAYMENT);
    }
}