/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "../../libraries/LibStalk.sol";
import "../../interfaces/ISeed.sol";
import "../../Seed.sol";

/**
 * @author LeoFib
 * @title InitBip10 runs the code for BIP-10. It adjusts Stalk and Seeds so they are now ERC20 Tokens
**/
contract InitBip10 {

    AppStorage internal s;
  
    function init() external {
      LibStalk.mint(address(this), s.s.stalk);
      s.s.stalk = 0;
      s.seedContract = address(new Seed());
      ISeed(s.seedContract).mint(address(this), s.s.seeds);
      s.s.seeds = 0;
    }
}