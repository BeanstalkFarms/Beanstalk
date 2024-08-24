/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "../../tokens/Fertilizer/Fertilizer.sol";
import {IProxyAdmin} from "../../interfaces/IProxyAdmin.sol";

/**
 * @author deadmanwalking
 * @title InitBipMiscImprovements updates the Fertilizer implementation
 * to use a decentralized uri
 **/

contract InitBipMiscImprovements {
    address constant FERTILIZER = 0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6;
    address constant PROXY_ADMIN = 0xfECB01359263C12Aa9eD838F878A596F0064aa6e;

    function init() external {
        // deploy new Fertilizer implementation
        Fertilizer fertilizer = new Fertilizer();
        // get the address of the new Fertilizer implementation
        address fertilizerImplementation = address(fertilizer);

        // upgrade to new Fertilizer implementation
        IProxyAdmin(PROXY_ADMIN).upgrade(address(FERTILIZER), fertilizerImplementation);
    }
}
