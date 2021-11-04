/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";
import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip1 runs the code for BIP-1. It mints Beans to the budget contracts.
**/
contract InitBip1 {

    AppStorage internal s;
    
    address private constant developmentBudget = address(0x83A758a6a24FE27312C1f8BDa7F3277993b64783);
    address private constant marketingBudget = address(0xAA420e97534aB55637957e868b658193b112A551 );

    function init() external {
        IBean(s.c.bean).mint(marketingBudget, 80000000000);
        IBean(s.c.bean).mint(developmentBudget, 120000000000);
    }
}