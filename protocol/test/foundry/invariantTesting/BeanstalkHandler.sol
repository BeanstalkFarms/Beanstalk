// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {C} from "contracts/C.sol";
import {LibConstant} from "test/foundry/utils/LibConstant.sol";
import {TestHelper, LibTransfer, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

import "forge-std/Test.sol";

contract BeanstalkHandler is Test {
    address constant BEANSTALK = LibConstant.BEANSTALK;

    address[] public depositors;
    IERC20 public bean = IERC20(C.BEAN);
    IMockFBeanstalk public bs = IMockFBeanstalk(BEANSTALK);

    address internal user;
    address[] public users;

    address internal token;
    address[] public tokens;

    // Ghost variables.
    mapping(address => mapping(address => int96[])) public userDeposits;
    mapping(address => uint256) public depositSumsTotal;
    mapping(address => mapping(address => uint256)) public depositSumsUser;
    mapping(address => uint256) public withdrawSumsTotal;
    mapping(address => mapping(address => uint256)) public withdrawSumsUser;

    constructor() {
        // Set up actor set.
        for (uint256 i = 0; i < 10; i++) {
            users.push(address(bytes20(keccak256(abi.encode(i)))));
        }

        // Set up whitelisted tokens.
        tokens.push(C.BEAN);
        // tokens.push(C.BEAN_ETH_WELL); // is not mock erc20
        // tokens.push(C.BEAN_WSTETH_WELL); // is not mock erc20
    }

    function deposit(uint16 userSeed, uint16 tokenSeed, uint256 amount) public useUser(userSeed) useToken(tokenSeed) {
        amount = bound(amount, 1, type(uint96).max);

        MockToken(token).mint(user, amount);
        bean.approve(address(bs), type(uint256).max);

        (,, int96 stem) = bs.deposit(token, amount, 0);

        depositSumsTotal[token] += amount;
        depositSumsUser[user][token] += amount;

        // Add stem if it does not yet exist.
        for (uint256 i = 0; i < userDeposits[user][token].length; i++) {
            if (userDeposits[user][token][i] == stem) return;
        }
        userDeposits[user][token].push(stem);
    }

    function withdraw(uint16 userSeed, uint16 tokenSeed, uint256 stemSeed, uint256 amount) public useUser(userSeed) useToken(tokenSeed) {
        // vm.assume(userDeposits[user][token].length > 0);
        if (userDeposits[user][token].length == 0) return;
        uint256 stemIndex = bound(stemSeed, 0, userDeposits[user][token].length - 1);
        int96 stem = userDeposits[user][token][stemIndex];
        (uint256 depositAmount,) = bs.getDeposit(user, token, stem);
        amount = bound(amount, 1, depositAmount);

        bs.withdrawDeposit(token, stem, amount, 0);

        if (amount == depositAmount) {
            userDeposits[user][token][stemIndex] = userDeposits[user][token][userDeposits[user][token].length - 1];
            userDeposits[user][token].pop();
        }

        withdrawSumsTotal[token] += amount;
        withdrawSumsUser[user][token] += amount;
    }

    ///// Helpers //////

    modifier useUser(uint16 actorIndexSeed) {
        user = users[bound(actorIndexSeed, 0, users.length - 1)];
        vm.startPrank(user);
        _;
        vm.stopPrank();
    }

    modifier useToken(uint16 tokenIndexSeed) {
        token = tokens[bound(tokenIndexSeed, 0, tokens.length - 1)];
        _;
    }
}
