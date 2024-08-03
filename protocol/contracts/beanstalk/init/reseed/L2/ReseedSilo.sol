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
        address token;
        int96 stemTip;
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
     * @notice reseed the silo deposits. 
     * @param  deposits an array of account deposits for any token
     * where each account's deposits can have many entries for the same token.
     * @dev all deposits and accounts are mown to the current season.
     */
    function reseedSiloDeposit(AccountSiloDeposits[] calldata deposits) internal {
        uint256 stalkIssuedPerBdv;
        // for all deposits of a token and account.
        for (uint256 i; i < deposits.length; i++) {
            uint128 calculatedBdv;
            uint256 calculatedStalk;
            // different stalkIssuedPerBdv for each token in the AccountSiloDeposits struct.
            stalkIssuedPerBdv = s.sys.silo.assetSettings[deposits[i].token].stalkIssuedPerBdv;
            // for all of account's deposits.
            for (uint256 j; j < deposits[i].dd.length; j++) {
                // get stem from depositId.
                (, int96 stem) = LibBytes.unpackAddressAndStem(deposits[i].dd[j].depositId);
                // verify that depositId is valid.
                require(deposits[i].stemTip >= stem, "ReseedSilo: INVALID_STEM");

                // add deposit to account.
                s.accts[deposits[i].account].deposits[deposits[i].dd[j].depositId].amount =
                    deposits[i].dd[j].amount;
                s.accts[deposits[i].account].deposits[deposits[i].dd[j].depositId].bdv =
                    deposits[i].dd[j].bdv;
                // add deposit to depositIdList.
                s.accts[deposits[i].account].depositIdList[deposits[i].token].depositIds.push(
                    deposits[i].dd[j].depositId
                );

                // increment calculatedBdv by bdv of deposit:
                calculatedBdv += deposits[i].dd[j].bdv;

                // increment calculatedStalk by grown stalk of deposit.
                calculatedStalk += uint96(deposits[i].stemTip - stem) * deposits[i].dd[j].bdv;

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
            s.accts[deposits[i].account].mowStatuses[deposits[i].token].bdv += calculatedBdv;
            s.accts[deposits[i].account].mowStatuses[deposits[i].token].lastStem += deposits[i].stemTip;

            // increment calculatedStalk by the stalk issued per BDV.
            // placed outside of loop for gas effiency.
            calculatedStalk += stalkIssuedPerBdv * calculatedBdv;

            // increment stalk for account.
            s.accts[deposits[i].account].stalk += calculatedStalk;
        }
    }
}
