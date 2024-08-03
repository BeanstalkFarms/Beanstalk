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
 * @author Brean
 * @notice ReseedSilo re-initializes the Silo.
 * @dev Deposits are re-issued to each holder. Silo is set to L1 state.
 */
contract ReseedSilo {
    using LibBytes for uint256;

    /**
     * @notice AccountSiloDeposits is a struct that contains the silo deposits for a given token and account.
     */
    struct AccountSiloDeposits {
        address token;
        int96 stemTip;
        address account;
        AccountDepositData[] dd;
    }

    // 1 account --> many deposits --> many deposit data

    struct AccountDepositData {
        // int96 stem;
        uint256 depositId;
        uint128 amount;
        uint128 bdv;
    }

    /**
     * @notice AddMigratedDeposit event is emitted when a deposit is added to the silo. See {TokenSilo.AddDeposit}
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
     * - re-issues stalk to the provided deposit holders.
     * note: token addresses will differ from L1.
     */
    function init(
        // many accounts that have many deposits of a token.
        AccountSiloDeposits[] calldata deposits
    ) external {
        // initialize deposits.
        reseedSiloDeposit(deposits);
    }

    /**
     * @notice reseed the silo deposit for a given token.
     * @param  deposits AccountSiloDeposits[] calldata deposits
     * @dev all deposits and accounts are mown to the current season.
     */
    function reseedSiloDeposit(AccountSiloDeposits[] calldata deposits) internal {
        // for all accounts.
        for (uint256 i; i < deposits.length; i++) {
            uint128 totalBdvForAccount;
            uint256 accountStalk;
            // different stalkIssuedPerBdv for each token.
            uint256 stalkIssuedPerBdv = s.sys.silo.assetSettings[deposits[i].token].stalkIssuedPerBdv;
            // for all of account's deposits.
            for (uint256 j; j < deposits[i].dd.length; j++) {

                // verify that depositId is valid.
                // int96 stem = deposits.dd[j].stem;
                // require(deposits.stemTip >= stem, "ReseedSilo: INVALID_STEM");
                // uint256 depositId = LibBytes.packAddressAndStem(siloDeposit.token, stem);
                
                // get stem from depositId.
                (, int96 stem) = LibBytes.unpackAddressAndStem(deposits[i].dd[j].depositId);
                // verify that depositId is valid.
                require(deposits[i].stemTip >= stem, "ReseedSilo: INVALID_STEM");

                // add deposit to account. Add to depositIdList.
                s.accts[deposits[i].account].deposits[deposits[i].dd[j].depositId].amount = deposits[i].dd[j].amount;
                s.accts[deposits[i].account].deposits[deposits[i].dd[j].depositId].bdv = deposits[i].dd[j].bdv;
                s.accts[deposits[i].account].depositIdList[deposits[i].token].depositIds.push(
                    deposits[i].dd[j].depositId
                );

                // increment totalBdvForAccount by bdv of deposit:
                totalBdvForAccount += deposits[i].dd[j].bdv;

                // increment by grown stalk of deposit.
                accountStalk += uint96(deposits[i].stemTip - stem) * deposits[i].dd[j].bdv;

                // emit events.
                emit AddMigratedDeposit(
                    deposits[i].account,
                    deposits[i].token,
                    stem,
                    deposits[i].dd[j].amount,
                    deposits[i].dd[j].bdv
                );
                emit TransferSingle(
                    deposits[i].account, // operator
                    address(0), // from
                    deposits[i].account, // to
                    deposits[i].dd[j].depositId, // depositID
                    deposits[i].dd[j].amount // token amount
                );
            }

            // update mowStatuses for account and token.
            s.accts[deposits[i].account].mowStatuses[deposits[i].token].bdv += totalBdvForAccount;
            s.accts[deposits[i].account].mowStatuses[deposits[i].token].lastStem += deposits[i].stemTip;

            // increment stalkForAccount by the stalk issued per BDV.
            // placed outside of loop for gas effiency.
            accountStalk += stalkIssuedPerBdv * totalBdvForAccount;

            // set stalk for account.
            s.accts[deposits[i].account].stalk = accountStalk;
        }
    }
}
