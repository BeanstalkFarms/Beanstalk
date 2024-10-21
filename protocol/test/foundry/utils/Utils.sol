// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import "forge-std/Test.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";
import {LibConstant} from "test/foundry/utils/LibConstant.sol";

/**
 * @dev common utilities for forge tests
 */
contract Utils is Test {
    IMockFBeanstalk public bs;

    // beanstalk
    address payable constant BEANSTALK =
        payable(address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5));

    address internal constant BEAN = LibConstant.BEAN;
    address internal constant UNRIPE_BEAN = LibConstant.UNRIPE_BEAN;
    address internal constant UNRIPE_LP = LibConstant.UNRIPE_LP;
    address internal constant WETH = LibConstant.WETH; // NOTE: setting L1 weth to weth here for tests is intentional
    address internal constant L1_WETH = LibConstant.L1_WETH;
    address internal constant WSTETH = LibConstant.WSTETH;
    address internal constant L1_WSTETH = LibConstant.L1_WSTETH;
    address internal constant USDC = LibConstant.USDC;
    address internal constant L1_USDC = LibConstant.L1_USDC;
    address internal constant USDT = LibConstant.USDT;
    address internal constant WBTC = LibConstant.WBTC;
    address internal constant L1_WBTC = LibConstant.L1_WBTC;
    address internal constant BEAN_ETH_WELL = LibConstant.BEAN_ETH_WELL;
    address internal constant BEAN_WSTETH_WELL = LibConstant.BEAN_WSTETH_WELL;
    address payable internal constant PIPELINE = payable(LibConstant.PIPELINE);

    address internal deployer;

    using Strings for uint256;
    using Strings for bytes;
    address payable[] internal users;

    bytes32 internal nextUser = keccak256(abi.encodePacked("user address"));

    /// @dev impersonate `from`
    modifier prank(address from) {
        vm.startPrank(from);
        _;
        vm.stopPrank();
    }

    function getNextUserAddress() public returns (address payable) {
        //bytes32 to address conversion
        address payable user = payable(address(bytes20(nextUser)));
        nextUser = keccak256(abi.encodePacked(nextUser));
        return user;
    }

    // create users with 100 ether balance
    function createUsers(uint256 userNum) public returns (address payable[] memory) {
        address payable[] memory _users = new address payable[](userNum);
        for (uint256 i = 0; i < userNum; i++) {
            address payable user = this.getNextUserAddress();
            vm.label(user, string(abi.encodePacked("Farmer ", i.toString())));
            vm.deal(user, 100 ether);
            _users[i] = user;
        }
        return _users;
    }

    function toStalk(uint256 stalk) public pure returns (uint256) {
        return stalk * 1e10;
    }
}
