/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedSilo re-initializes the silo.
 * @dev deposits are re-issued to each holder. Silo is set to L1 state.
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
        uint128 totalDeposits;
        uint128 totalDepositedBdv;
    }

    /**
     * @notice AccountSiloDeposits is a struct that contains the silo deposits for a given account.
     */
    struct AccountSiloDeposits {
        address accounts;
        uint256[] depositIds;
        uint128[] amounts;
        uint128[] bdvs;
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
        uint256 stalkIssuedPerBdv = s.ss[siloDeposit.token].stalkIssuedPerBdv;
        for (uint256 i; i < siloDeposit.siloDepositsAccount.length; i++) {
            AccountSiloDeposits memory deposits = siloDeposit.siloDepositsAccount[i];
            uint128 totalBdvForAccount;
            uint256 accountStalk;
            for (uint256 j; j < deposits.depositIds.length; j++) {
                // verify that depositId is valid.
                uint256 depositId = deposits.depositIds[j];
                (address depositToken, int96 stem) = depositId.unpackAddressAndStem();
                require(depositToken == siloDeposit.token, "ReseedSilo: INVALID_DEPOSIT_ID");
                require(siloDeposit.stemTip >= stem, "ReseedSilo: INVALID_STEM");

                // add deposit to account.
                s.a[deposits.accounts].deposits[depositId].amount = deposits.amounts[j];
                s.a[deposits.accounts].deposits[depositId].bdv = deposits.bdvs[j];

                // increment totalBdvForAccount by bdv of deposit:
                totalBdvForAccount += deposits.bdvs[j];

                // increment by grown stalk of deposit.
                accountStalk += uint96(siloDeposit.stemTip - stem) * deposits.bdvs[j];

                // increment totalCalcDeposited and totalCalcDepositedBdv.
                totalCalcDeposited += deposits.amounts[j];
                totalCalcDepositedBdv += deposits.bdvs[j];

                // emit events.
                emit AddDeposit(
                    deposits.accounts,
                    siloDeposit.token,
                    stem,
                    deposits.amounts[j],
                    deposits.bdvs[j]
                );
                emit TransferSingle(
                    deposits.accounts, // operator
                    address(0), // from
                    deposits.accounts, // to
                    depositId, // depositID
                    deposits.amounts[j] // token amount
                );
            }
            // update mowStatuses for account and token.
            s.a[deposits.accounts].mowStatuses[siloDeposit.token].bdv = totalBdvForAccount;
            s.a[deposits.accounts].mowStatuses[siloDeposit.token].lastStem = siloDeposit.stemTip;

            // increment stalkForAccount by the stalk issued per BDV.
            // placed outside of loop for gas effiency.
            accountStalk += stalkIssuedPerBdv * totalBdvForAccount;

            // set stalk for account.
            s.a[deposits.accounts].s.stalk = accountStalk;
        }

        // verify that the total deposited and total deposited bdv are correct.
        require(
            totalCalcDeposited == siloDeposit.totalDeposits,
            "ReseedSilo: INVALID_TOTAL_DEPOSITS"
        );
        require(
            totalCalcDepositedBdv == siloDeposit.totalDepositedBdv,
            "ReseedSilo: INVALID_TOTAL_DEPOSITED_BDV"
        );

        // set global state
        s.siloBalances[siloDeposit.token].deposited = siloDeposit.totalDeposits;
        s.siloBalances[siloDeposit.token].depositedBdv = siloDeposit.totalDepositedBdv;
    }
}
