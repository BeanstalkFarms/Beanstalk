/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Publius
 * @title InitSiloV2 Initializes SiloV2.
**/

contract InitSiloV2 {
    AppStorage internal s;

    function init() external {
        s.siloBalances[IERC20(s.c.pair)].deposited = s.lp.deposited;
        delete s.lp.deposited;
        s.siloBalances[IERC20(s.c.pair)].withdrawn = s.lp.withdrawn;
        delete s.lp.withdrawn;
    }
}