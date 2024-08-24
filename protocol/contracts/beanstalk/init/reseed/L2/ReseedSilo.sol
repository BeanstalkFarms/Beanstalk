/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {C} from "contracts/C.sol";
import "forge-std/console.sol";

/**
 * @author Brean, Deadmanwalking
 * @notice ReseedSilo re-initializes the Silo.
 * @dev Deposits are re-issued to each holder. Silo is set to L1 state.
 */
contract ReseedSilo {
    using LibBytes for uint256;

    mapping (address l1Token => address l2Token) public tokenMap;

    /**
     * @notice AccountSiloDeposits is a struct that contains the silo deposit entries
     * for a given account.
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
    function init(AccountSiloDeposits[] calldata accountDeposits) external {
        // initialize mapping of L1 token to L2 token.
        // BEAN
        tokenMap[address(0x1111111111111111111111111111111111111111)] = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
        // URBEAN
        tokenMap[address(0x4444444444444444444444444444444444444444)] = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
        // URLP
        tokenMap[address(0x5555555555555555555555555555555555555555)] = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);
        // BEAN/WETH
        tokenMap[address(0x2222222222222222222222222222222222222222)] = address(0xBEA02d411690A8Aa418E6606fFf5C964933645E0);
        // BEAN/WstETH
        tokenMap[address(0x3333333333333333333333333333333333333333)] = address(0xBEA046038302b14e2Bab2636d1E8FaacE602e0aa);
        // BEAN/STABLE (Mapped to BEAN/USDC)
        tokenMap[address(0x6666666666666666666666666666666666666666)] = address(0xBEA0F599087480c49eC21a9aAa66CBE0A53B6741);
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
                (address token, int96 stem) = LibBytes.unpackAddressAndStem(
                    accountDeposits[i].dd[j].depositId
                );
                // Since we do not unpack the token address and stem prior to running the init script,
                // the token here refers to the L1 token address. We need to map this to the L2 token address.
                token = tokenMap[token];
                // since the token address is changed, we need to update the depositId.
                uint256 l2DepositId = LibBytes.packAddressAndStem(token, stem);

                // add deposit to account.
                s
                    .accts[accountDeposits[i].account]
                    .deposits[l2DepositId]
                    .amount = accountDeposits[i].dd[j].amount;
                s
                    .accts[accountDeposits[i].account]
                    .deposits[l2DepositId]
                    .bdv = accountDeposits[i].dd[j].bdv;
                console.log("pushing deposit id to depositIdList");
                console.log("Account: %s", accountDeposits[i].account);
                console.log("Token: %s", token);
                console.log("Deposit ID: %s", l2DepositId);
                console.log("Amount: %s", accountDeposits[i].dd[j].amount);
                console.log("BDV: %s", accountDeposits[i].dd[j].bdv);
                // add deposit to depositIdList.
                s.accts[accountDeposits[i].account].depositIdList[token].depositIds.push(
                    l2DepositId
                );
                console.log("Deposit ID List Length After push: %s", s.accts[accountDeposits[i].account].depositIdList[token].depositIds.length);
                console.log("Deposit ID List element: %s", s.accts[accountDeposits[i].account].depositIdList[token].depositIds[j]);
                // set deposit id to index mapping, after adding deposit to deposit list
                // this way the length of the depositIds array is always >0.
                s.accts[accountDeposits[i].account].depositIdList[token].idIndex[
                    l2DepositId
                ] = s.accts[accountDeposits[i].account].depositIdList[token].depositIds.length - 1;
                console.log("Deposit ID Index: %s", s.accts[accountDeposits[i].account].depositIdList[token].idIndex[l2DepositId]);
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
                    l2DepositId, // depositID
                    accountDeposits[i].dd[j].amount // token amount
                );
            }
        }
    }
}
