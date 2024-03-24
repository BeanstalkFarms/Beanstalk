// // SPDX-License-Identifier: MIT
// pragma solidity =0.7.6;
// pragma abicoder v2;

// import "forge-std/Test.sol";

// import { Bean } from "contracts/tokens/Bean.sol";
// import { Utils } from "test/foundry/utils/Utils.sol";

// contract BeanTest is Bean, Test {
//   Utils internal utils;
//   address payable[] internal users;
//   address internal alice;
  
//   function setUp() public {
//     utils = new Utils();
//     users = utils.createUsers(2);

//     alice = users[0];
//     vm.label(alice, "Alice");
//   }

//   function test_mint() public {
//     uint256 amount = 100e6;
//     _mint(alice, amount);
//     assertEq(balanceOf(alice), amount);
//   }
// }