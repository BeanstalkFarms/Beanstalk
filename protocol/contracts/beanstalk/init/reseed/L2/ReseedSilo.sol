/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean, Deadmanwalking
 * @notice ReseedSilo re-initializes the Silo.
 * @dev Deposits are re-issued to each holder. Silo is set to L1 state.
 */
contract ReseedSilo {
    using LibBytes for uint256;

    /**
     * @notice AccountSiloDeposits is a struct that contains the silo deposit entries
     * for a given token and account.
     */
    struct AccountSiloDeposits {
        address account;
        AccountDepositData[] dd;
    }

    struct AccountDepositData {
        uint256 depositId;
        uint128 amount;
        uint128 bdv;
    }

    /**
     * @notice AddMigratedDeposit event is emitted when a deposit is added to the silo.
     * See {TokenSilo.AddDeposit}
     */
    event AddMigratedDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice TransferSingle event is emitted when a transfer is made. See {IERC1155.TransferSingle}
     */
    event TransferSingle(
        address indexed operator,
        address indexed sender,
        address indexed recipient,
        uint256 depositId,
        uint256 amount
    );

    AppStorage internal s;

    /**
     * @notice Initialize the silo with the given deposits.
     * @dev performs the following:
     * - re-deposits the provided deposits to the silo.
     * note: token addresses will differ from L1.
     */
    function init(
        AccountSiloDeposits[] calldata accountDeposits
    ) external {
        // initialize deposits.
        reseedSiloDeposit(accountDeposits);
    }

    /**
     * @notice reseed the silo deposits.
     * @param accountDeposits an array of account deposits to reseed where each account
     * can have multiple deposits.
     * @dev the account's stalk and mow statuses are handled in a separate contract. 
     */
    function reseedSiloDeposit(AccountSiloDeposits[] calldata accountDeposits) internal {
        // for all accounts
        for (uint256 i; i < accountDeposits.length; i++) {
            // for all of account's deposits.
            for (uint256 j; j < accountDeposits[i].dd.length; j++) {
                // get token and stem from depositId.
                (address token, int96 stem) = LibBytes.unpackAddressAndStem(accountDeposits[i].dd[j].depositId);
                // add deposit to account.
                s
                    .accts[accountDeposits[i].account]
                    .deposits[accountDeposits[i].dd[j].depositId]
                    .amount = accountDeposits[i].dd[j].amount;
                s.accts[accountDeposits[i].account].deposits[accountDeposits[i].dd[j].depositId].bdv = accountDeposits[i]
                    .dd[j]
                    .bdv;
                // add deposit to depositIdList.
                s.accts[accountDeposits[i].account].depositIdList[token].depositIds.push(
                    accountDeposits[i].dd[j].depositId
                );

                // emit events.
                emit AddMigratedDeposit(
                    accountDeposits[i].account,
                    token,
                    stem,
                    accountDeposits[i].dd[j].amount,
                    accountDeposits[i].dd[j].bdv
                );
                emit TransferSingle(
                    accountDeposits[i].account, // operator
                    address(0), // from
                    accountDeposits[i].account, // to
                    accountDeposits[i].dd[j].depositId, // depositID
                    accountDeposits[i].dd[j].amount // token amount
                );
            }
        }
    }
}
