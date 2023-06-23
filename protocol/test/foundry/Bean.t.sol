// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";

import { Bean } from "~/tokens/Bean.sol";
import { Utils } from "test/foundry/utils/Utils.sol";

contract BeanTest is Bean, Test {
  Utils internal utils;
  address payable[] internal users;
  address internal alice;
  
  function setUp() public {
    utils = new Utils();
    users = utils.createUsers(2);

    alice = users[0];
    vm.label(alice, "Alice");
  }

  function test_mint() public {
    uint256 amount = 100e6;
    _mint(alice, amount);
    assertEq(balanceOf(alice), amount);
  }

  // FIXME: this isn't reverting right now
  // _mint() still thinks msg.sender = 0x00a329c0648769A73afAc7F9381E08FB43dBEA72
  // and so minting to alice doesn't revert.
  // function testFailMint() public {
  //   vm.prank(alice, alice);
  //   console.log("msg.sender = %s", msg.sender);
  //   console.log("alice = %s", alice);
  //   _mint(alice, 100e6); // should revert
  // }
}