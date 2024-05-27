// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage} from "./storage/AppStorage.sol";

/**
 * @author Beanstalk Farms
 * @title Variation of Oepn Zeppelins reentrant guard to include Silo Update
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts%2Fsecurity%2FReentrancyGuard.sol
 **/
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    AppStorage internal s;

    modifier nonReentrant() {
        require(s.sys.reentrantStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        s.sys.reentrantStatus = _ENTERED;
        _;
        s.sys.reentrantStatus = _NOT_ENTERED;
    }
}
