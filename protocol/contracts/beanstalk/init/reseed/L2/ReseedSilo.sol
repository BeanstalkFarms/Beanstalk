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
     * @notice SiloDeposits is a struct that contains the silo deposits for a given tokens.
     */
    struct SiloDeposits {
        address token;
        AccountSiloDeposits[] siloDepositsAccount;
        int96 stemTip;
        uint128 totalDeposited;
        uint128 totalDepositedBdv;
    }

    /**
     * @notice AccountSiloDeposits is a struct that contains the silo deposits for a given account.
     */
    struct AccountSiloDeposits {
        address accounts;
        AccountDepositData[] dd;
    }

    struct AccountDepositData {
        int96 stem;
        uint128 amount;
        uint128 bdv;
    }

    /**
     * @notice AddDeposit event is emitted when a deposit is added to the silo. See {TokenSilo.AddDeposit}
     */
    event AddDeposit(
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
     * - re-deposits all deposits to the silo.
     * - re-issues all stalk to holders.
     * note: token addresses will differ from L1.
     */
    function init(
        SiloDeposits calldata beanDeposits,
        SiloDeposits calldata beanEthDeposits,
        SiloDeposits calldata beanWstEthDeposits,
        SiloDeposits calldata bean3CrvDeposits,
        SiloDeposits calldata urBeanDeposits,
        SiloDeposits calldata urBeanLpDeposits
    ) external {
        // initialize beanDeposits.
        reseedSiloDeposit(beanDeposits);

        // initialize beanEthDeposits.
        reseedSiloDeposit(beanEthDeposits);

        // initialize beanWstEthDeposits.
        reseedSiloDeposit(beanWstEthDeposits);

        // initialize beanStableDeposits.
        reseedSiloDeposit(bean3CrvDeposits);

        // initialize urBeanDeposits.
        reseedSiloDeposit(urBeanDeposits);

        // initialize urBeanLpDeposits.
        reseedSiloDeposit(urBeanLpDeposits);
    }

    /**
     * @notice reseed the silo deposit for a given token.
     * @param siloDeposit The silo deposit data
     * @dev all deposits and accounts are mown to the current season.
     */
    function reseedSiloDeposit(SiloDeposits calldata siloDeposit) internal {
        uint256 totalCalcDeposited;
        uint256 totalCalcDepositedBdv;
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
                s.accts[deposits.accounts].deposits[depositId].amount = deposits.dd[j].amount;
                s.accts[deposits.accounts].deposits[depositId].bdv = deposits.dd[j].bdv;
                s.accts[deposits.accounts].depositIdList[siloDeposit.token].push(depositId);

                // increment totalBdvForAccount by bdv of deposit:
                totalBdvForAccount += deposits.dd[j].bdv;

                // increment by grown stalk of deposit.
                accountStalk += uint96(siloDeposit.stemTip - stem) * deposits.dd[j].bdv;

                // increment totalCalcDeposited and totalCalcDepositedBdv.
                totalCalcDeposited += deposits.dd[j].amount;
                totalCalcDepositedBdv += deposits.dd[j].bdv;

                // emit events.
                emit AddDeposit(
                    deposits.accounts,
                    siloDeposit.token,
                    stem,
                    deposits.dd[j].amount,
                    deposits.dd[j].bdv
                );
                emit TransferSingle(
                    deposits.accounts, // operator
                    address(0), // from
                    deposits.accounts, // to
                    depositId, // depositID
                    deposits.dd[j].amount // token amount
                );
            }
            // update mowStatuses for account and token.
            s.accts[deposits.accounts].mowStatuses[siloDeposit.token].bdv = totalBdvForAccount;
            s.accts[deposits.accounts].mowStatuses[siloDeposit.token].lastStem = siloDeposit
                .stemTip;

            // increment stalkForAccount by the stalk issued per BDV.
            // placed outside of loop for gas effiency.
            accountStalk += stalkIssuedPerBdv * totalBdvForAccount;

            // set stalk for account.
            s.accts[deposits.accounts].stalk = accountStalk;
        }

        // verify that the total deposited and total deposited bdv are correct.
        require(
            totalCalcDeposited == siloDeposit.totalDeposited,
            "ReseedSilo: INVALID_TOTAL_DEPOSITS"
        );
        require(
            totalCalcDepositedBdv == siloDeposit.totalDepositedBdv,
            "ReseedSilo: INVALID_TOTAL_DEPOSITED_BDV"
        );

        // set global state
        s.sys.silo.balances[siloDeposit.token].deposited = siloDeposit.totalDeposited;
        s.sys.silo.balances[siloDeposit.token].depositedBdv = siloDeposit.totalDepositedBdv;
    }
}
