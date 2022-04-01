/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IBean.sol";
import '../AppStorage.sol';

/**
 * @author Beasley
 * @title InitBip15 approves the BEAN:3CRV and BEAN:LUSD curve pools.
**/

contract InitBip15 {
  AppStorage internal s;

  address private constant BEAN_LUSD = address(0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D);
  address private constant LUSD = address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0);
  address private constant THREE_CURVE = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
  address private constant BEAN_3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
  
  function init() external {
      IBean(s.c.bean).approve(BEAN_LUSD, uint256(-1));
      IBean(s.c.bean).approve(BEAN_3CRV, uint256(-1));
      IERC20(LUSD).approve(BEAN_LUSD, uint256(-1));
      IERC20(THREE_CURVE).approve(BEAN_3CRV, uint256(-1));
  }
}
