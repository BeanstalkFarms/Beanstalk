/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {WhitelistedTokens} from "contracts/beanstalk/silo/WhitelistFacet/WhitelistedTokens.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {SeedGaugeSettings} from "contracts/beanstalk/storage/System.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";

/**
 * @author pizzaman1337
 * @title Oracle Facet
 * @notice Exposes Oracle Functionality
 **/
contract OracleFacet is Invariable, ReentrancyGuard {}
