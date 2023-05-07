/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "../ReentrancyGuard.sol";
import "./SiloFacet/Silo.sol";
import "./SiloFacet/TokenSilo.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "~/libraries/Silo/LibLegacyTokenSilo.sol";
import "~/libraries/Convert/LibConvert.sol";
import "~/libraries/LibSafeMath32.sol";

/**
 * @author pizzaman1337
 * @title Handles Migration related functions for the new Silo
 **/
contract MigrationFacet is ReentrancyGuard {

    /** 
     * @notice Migrates farmer's deposits from old (seasons based) to new silo (stems based).
     * @param account Address of the account to migrate
     * @param tokens Array of tokens to migrate
     * @param seasons The seasons in which the deposits were made
     * @param amounts The amounts of those deposits which are to be migrated
     *
     *
     * @dev When migrating an account, you must submit all of the account's deposits,
     * or the migration will not pass because the seed check will fail. The seed check
     * adds up the BDV of all submitted deposits, and multiples by the corresponding
     * seed amount for each token type, then compares that to the total seeds stored for that user.
     * If everything matches, we know all deposits were submitted, and the migration is valid.
     *
     * Deposits are migrated to the stem storage system on a 1:1 basis. Accounts with
     * lots of deposits may take a considerable amount of gas to migrate.
     */
    function mowAndMigrate(
        address account, 
        address[] calldata tokens, 
        uint32[][] calldata seasons,
        uint256[][] calldata amounts,
        uint256 stalkDiff,
        uint256 seedsDiff,
        bytes32[] calldata proof
    ) external payable {
        uint256 seedsVariance = LibLegacyTokenSilo._mowAndMigrate(account, tokens, seasons, amounts);
        //had to break up the migration function into two parts to avoid stack too deep errors
        LibLegacyTokenSilo._mowAndMigrateMerkleCheck(account, stalkDiff, seedsDiff, proof, seedsVariance);
    }

    /** 
     * @notice Migrates farmer's deposits from old (seasons based) to new silo (stems based).
     * @param account Address of the account to migrate
     *
     * @dev If a user's lastUpdate was set, which means they had deposits in the silo,
     * but they currently have no deposits, then this function can be used to migrate
     * their account to the new silo using less gas.
     */
    function mowAndMigrateNoDeposits(address account) external payable {
        LibLegacyTokenSilo._migrateNoDeposits(account);
    }


}