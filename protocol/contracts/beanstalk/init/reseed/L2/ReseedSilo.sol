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
     * @notice SiloDeposits is a struct that contains the silo deposits for a given token.
     */
    struct SiloDeposits {
        address token;
        AccountSiloDeposits[] siloDepositsAccount;
        int96 stemTip;
    }

    /**
     * @notice AccountSiloDeposits is a struct that contains the silo deposits for a given account.
     */
    struct AccountSiloDeposits {
        address account;
        AccountDepositData[] dd;
    }

    struct AccountDepositData {
        int96 stem;
        uint128 amount;
        uint128 bdv;
    }

    /**
     * @notice AddMigratedDeposit event is emitted when a migrated deposit is added to the silo. See {TokenSilo.AddDeposit}
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
        SiloDeposits calldata deposits
    ) external {
        // initialize deposits.
        reseedSiloDeposit(deposits);
    }

    /**
     * @notice reseed the silo deposit for a given token.
     * @param siloDeposit The silo deposit data
     * @dev all deposits and accounts are mown to the current season.
     */
    function reseedSiloDeposit(SiloDeposits calldata siloDeposit) internal {
        uint256 stalkIssuedPerBdv = s.sys.silo.assetSettings[siloDeposit.token].stalkIssuedPerBdv;
        for (uint256 i; i < siloDeposit.siloDepositsAccount.length; i++) {
            AccountSiloDeposits memory deposits = siloDeposit.siloDepositsAccount[i];
            uint128 totalBdvForAccount;
            uint256 accountStalk;
            for (uint256 j; j < deposits.dd.length; j++) {
                // verify that depositId is valid.
                int96 stem = deposits.dd[j].stem;
                require(siloDeposit.stemTip >= stem, "ReseedSilo: INVALID_STEM");
                uint256 depositId = LibBytes.packAddressAndStem(siloDeposit.token, stem);

                // add deposit to account. Add to depositIdList.
                s.accts[deposits.account].deposits[depositId].amount = deposits.dd[j].amount;
                s.accts[deposits.account].deposits[depositId].bdv = deposits.dd[j].bdv;
                s.accts[deposits.account].depositIdList[siloDeposit.token].depositIds.push(
                    depositId
                );

                // increment totalBdvForAccount by bdv of deposit:
                totalBdvForAccount += deposits.dd[j].bdv;

                // increment by grown stalk of deposit.
                accountStalk += uint96(siloDeposit.stemTip - stem) * deposits.dd[j].bdv;

                // emit events.
                emit AddMigratedDeposit(
                    deposits.account,
                    siloDeposit.token,
                    stem,
                    deposits.dd[j].amount,
                    deposits.dd[j].bdv
                );
                emit TransferSingle(
                    deposits.account, // operator
                    address(0), // from
                    deposits.account, // to
                    depositId, // depositID
                    deposits.dd[j].amount // token amount
                );
            }
            // update mowStatuses for account and token.
            s.accts[deposits.account].mowStatuses[siloDeposit.token].bdv = totalBdvForAccount;
            s.accts[deposits.account].mowStatuses[siloDeposit.token].lastStem = siloDeposit
                .stemTip;

            // increment stalkForAccount by the stalk issued per BDV.
            // placed outside of loop for gas effiency.
            accountStalk += stalkIssuedPerBdv * totalBdvForAccount;

            // set stalk for account.
            s.accts[deposits.account].stalk = accountStalk;
        }
    }
}
