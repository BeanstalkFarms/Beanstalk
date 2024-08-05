// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage} from "./storage/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Beanstalk Farms
 * @title Variation of Oepn Zeppelins reentrant guard to include Beanstalk specific functionality.
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts%2Fsecurity%2FReentrancyGuard.sol
 **/
abstract contract ReentrancyGuard {
    AppStorage internal s;

    /**
     * @dev Standard reentrancy is not compatible with farm-like features. See _beanstalkCall().
     */
    modifier nonReentrant() {
        require(s.sys.reentrantStatus != C.ENTERED, "ReentrancyGuard: reentrant call");
        s.sys.reentrantStatus = C.ENTERED;
        _;
        s.sys.reentrantStatus = C.NOT_ENTERED;
    }
}
