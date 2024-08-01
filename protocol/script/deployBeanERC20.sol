// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import "forge-std/console.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";

contract DeployCreate2Bean is Script {
    function run() external {
        address facetaddress = 0xA67Bb84eE14221858d4edAA266C0D109D18685bB;

        // get the bytecode + constructor args same as in ReseedBean.sol (this method works)
        address admin = 0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70;
        bytes memory args = abi.encode(admin, "Bean", "BEAN");
        bytes memory bytecode = abi.encodePacked(
            vm.getCode("contracts/tokens/ERC20/BeanstalkERC20.sol:BeanstalkERC20"),
            args
        );
        // console.logBytes(bytecode);

        //// THIS WORKS: Take the hash of the bytecode +
        // + constructor args packed and mine with caller and deployer being the diamond address
        string memory BEAN_NAME = "Bean";
        string memory BEAN_SYMBOL = "BEAN";
        bytes32 BEAN_SALT = 0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb70b115b16c5e1ca208f6ba0715;
        address diamondAddress = 0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70;
        // address alternateAddress = 0xf15689636571dba322b48E9EC9bA6cFB3DF818e1;
        vm.prank(diamondAddress);
        // now msg.sender is diamondAddress
        // is deployer the facet address?
        console.log("address(this):", address(this));
        BeanstalkERC20 bean = new BeanstalkERC20{salt: BEAN_SALT}(
            diamondAddress,
            BEAN_NAME,
            BEAN_SYMBOL
        );
        console.log("Bean deployed at:", address(bean));

        //// THIS WORKS: Take the hash of the bytecode +
        // + constructor args packed and mine with caller and deployer being the bcm address
        bytes32 BEAN_SALT2 = 0xa9ba2c40b263843c04d344727b954a545c81d0438c00a9e0923b6878c9547cbb;
        address bcm = 0xa9bA2C40b263843C04d344727b954A545c81D043;
        vm.prank(bcm);
        BeanstalkERC20 bean2 = new BeanstalkERC20{salt: BEAN_SALT2}(
            diamondAddress,
            BEAN_NAME,
            BEAN_SYMBOL
        );
        console.log("Bean2 deployed at:", address(bean2));
    }
}
