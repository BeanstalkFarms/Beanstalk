// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Account} from "./Account.sol";
import {System} from "./System.sol";

/**
 * @title AppStorage
 * @dev The Beanstalk diamond uses an AppStorage system that shares state across all facets.
 * @dev https://dev.to/mudgen/appstorage-pattern-for-state-variables-in-solidity-3lki
 */

/**
 * @title AppStorage
 * @notice Contains all state for the Beanstalk Diamond.
 * @param sys Contains shared state of the system as a whole.
 * @param accts Contains state of individual users.
 */
struct AppStorage {
    mapping(address => Account) accts;
    System sys;
}
