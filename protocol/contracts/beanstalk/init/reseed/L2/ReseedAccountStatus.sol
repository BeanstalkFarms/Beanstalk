/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {MowStatus} from "contracts/beanstalk/storage/Account.sol";
import {GerminationSide} from "contracts/beanstalk/storage/System.sol";

/**
 * @author Deadmanwalking
 * @notice ReseedAccountStatus re-initializes an account's stalk, roots,
 * and mow statuses for each token.
 */
contract ReseedAccountStatus {
    AppStorage internal s;

    // Given that every account will be credited as if they've performed a Mow, lastStem will be constant.
    // TODO: Update this to the last value from snapshot.
    int96 internal constant LAST_STEM = 10;

    struct AccountStatus {
        address account;
        uint256 stalk;
        address[] tokens;
        MowStatus[] mowStatuses;
        uint32 lastUpdate;
        uint128 germinatingStalkOdd;
        uint128 germinatingStalkEven;
    }

    // emitted when a status is migrated.
    event MigratedAccountStatus(
        address indexed account,
        address indexed token,
        uint256 stalk,
        uint256 roots,
        uint256 bdv,
        int96 lastStem
    );

    function init(AccountStatus[] calldata accountStatuses) external {
        // for each account
        for (uint i = 0; i < accountStatuses.length; i++) {
            // for each token
            for (uint j = 0; j < accountStatuses[i].tokens.length; j++) {
                // update mowStatuses for account and token.
                s
                    .accts[accountStatuses[i].account]
                    .mowStatuses[accountStatuses[i].tokens[j]]
                    .bdv = accountStatuses[i].mowStatuses[j].bdv;
                s
                    .accts[accountStatuses[i].account]
                    .mowStatuses[accountStatuses[i].tokens[j]]
                    .lastStem = LAST_STEM;
            }
            // set stalk and roots for account.
            s.accts[accountStatuses[i].account].stalk = accountStatuses[i].stalk;
            s.accts[accountStatuses[i].account].roots = accountStatuses[i].stalk * 1e12;
            // set lastUpdate for account.
            s.accts[accountStatuses[i].account].lastUpdate = accountStatuses[i].lastUpdate;
            // set germinatingStalk for account.
            s.accts[accountStatuses[i].account].germinatingStalk[
                GerminationSide.ODD
            ] = accountStatuses[i].germinatingStalkOdd;
            s.accts[accountStatuses[i].account].germinatingStalk[
                GerminationSide.EVEN
            ] = accountStatuses[i].germinatingStalkEven;
        }
    }
}
