/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "~/libraries/Silo/LibLegacyTokenSilo.sol";
import "../SiloFacet/Silo.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/Convert/LibConvert.sol";
import "~/libraries/LibInternal.sol";
import "../../ReentrancyGuard.sol";
import "../SiloFacet/TokenSilo.sol";

/**
 * @author pizzaman1337
 * @title Handles Migration related functions for the new Silo
 **/
contract MigrationFacet is ReentrancyGuard {

    //function to mow and migrate
    function mowAndMigrate(address account, address[] calldata tokens, uint32[][] calldata seasons, uint256[][] calldata amounts) external payable {
        LibLegacyTokenSilo._mowAndMigrate(account, tokens, seasons, amounts);
    }

    //cheaper function to mow and migrate if you have no deposits
    function mowAndMigrateNoDeposits(address account) external payable {
        LibLegacyTokenSilo._migrateNoDeposits(account);
    }


}