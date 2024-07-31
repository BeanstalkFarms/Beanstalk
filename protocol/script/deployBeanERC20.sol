// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import "forge-std/console.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";

contract DeployCreate2 is Script {
    function run() external {
        // Deploy Bean
        address admin = address(0xa9bA2C40b263843C04d344727b954A545c81D043);
        BeanstalkERC20 bean = new BeanstalkERC20(admin, "Bean", "BEAN");
        // console.log("Bean deployed at:", address(bean));
        // // vm.getDeployedCode("contracts/tokens/ERC20/BeanstalkERC20.sol:BeanstalkERC20");
        console.logBytes(address(bean).code);

        // bytes memory args = abi.encode(admin, "Bean", "BEAN");
        // bytes memory bytecode = abi.encodePacked(
        //     vm.getCode("contracts/tokens/ERC20/BeanstalkERC20.sol:BeanstalkERC20"),
        //     args
        // );
        // console.logBytes(bytecode);
    }
}
