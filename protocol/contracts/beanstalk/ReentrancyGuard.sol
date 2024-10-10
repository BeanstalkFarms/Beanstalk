// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage} from "./storage/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Beanstalk Farms
 * @title Variation of Oepn Zeppelins reentrant guard to include Beanstalk specific functionality.
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts%2Fsecurity%2FReentrancyGuard.sol
 *
 * The key difference between Beanstalk reentrancy and standard reentrancy is the need for Beanstalk
 * to be able to re-enter itself executing functions through farm-like functions. This Farm functiiionality
 * allows users to batch multiple Beanstalk functions into a single transaction.
 * Examples of Farm use can be seen in Farm, AdvancedFarm, Tractor, and PipelineConvert.
 * Reference _beanstalkCall() to see Farm interaction with ReentrancyGuard.
 **/
abstract contract ReentrancyGuard {
    AppStorage internal s;

    /**
     * @notice Verify Beanstalk is not already entered and lock entrance.
     * @dev Standard reentrancy is not compatible with farm-like features.
     */
    modifier nonReentrant() {
        require(s.sys.reentrantStatus != C.ENTERED, "ReentrancyGuard: reentrant call");

        s.sys.reentrantStatus = C.ENTERED;
        _;
        s.sys.reentrantStatus = C.NOT_ENTERED;
    }

    /**
     * @notice Verify and lock both standard entrance and farming entrance.
     * @dev This modifier should be used on all functions that contain generalized Farm calls.
     */
    modifier nonReentrantFarm() {
        require(s.sys.farmingStatus != C.ENTERED, "ReentrancyGuard: reentrant farm call");
        require(s.sys.reentrantStatus != C.ENTERED, "ReentrancyGuard: reentrant call");

        s.sys.farmingStatus = C.ENTERED;
        s.sys.reentrantStatus = C.ENTERED;
        _;
        s.sys.farmingStatus = C.NOT_ENTERED;
        s.sys.reentrantStatus = C.NOT_ENTERED;
    }
}
