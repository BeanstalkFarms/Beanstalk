/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../LibSafeMath128.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Lib Unripe Silo
 * 
 * @dev When Beanstalk was relaunched in August 2022, new two tokens: Unripe Bean and Unripe Bean:3Crv were created and whitelisted in the Silo (See {Relant8.init}).
 * Existing Bean and Bean LP Depositors were credited with Unripe Bean Deposits and Unripe Bean:3Crv Deposits respectively equal to the BDV of each Deposit at the end of thet pre-exploit block.
 * {Replant7.init} migrated the Deposits through events by emitting {RemoveSeason(s)} or {LPRemove} for Bean and LP Deposits, and {AddDeposit} for Unripe Bean and Unripe LP distributions for all accounts.
 * Moving all on-chain non-zero Bean Deposit storage variables to the Unripe Bean Deposit storage mapping was prohibitively expensive.
 * {LibUnripeSilo} remaps pre-exploit Bean and LP Deposit storage references to Unripe Bean and Unripe Bean:3Crv Deposits.
 * New Unripe Bean and Unripe Bean:3Crv Deposits are stored in the expected Silo V2 storage location.
 */
library LibUnripeSilo {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    /*
     * At the time of exploit, Beanstalk had three pools: BEAN:ETH, BEAN:3CRV, BEAN:LUSD. The values
     * below represent the {LibTokenSilo.beanDenominatedValue} of each LP token at the end of the block 14602789 (the block before the exploit).
     * {LibUnripeSilo} uses these constants.
     * 
     * Note that the BDV of BEAN itself is always 1, hence why only LP tokens appear below.
     */
    
    uint256 private constant AMOUNT_TO_BDV_BEAN_ETH = 119_894_802_186_829; // 18 decimal precision
    uint256 private constant AMOUNT_TO_BDV_BEAN_3CRV = 992_035; // 6 decimal precision
    uint256 private constant AMOUNT_TO_BDV_BEAN_LUSD = 983_108; // 6 decimal precision

    //////////////////////// Unripe BEAN ////////////////////////

    /**
     * Unripe Bean Deposits stored in the Silo V1 Bean storage reference have not yet been Enrooted as
     * Enrooting moves the Deposit into the Unripe Bean Silo V2 storage reference (See {SiloFacet.enrootDeposit(s)}).
     * Thus, the BDV of Unripe Bean Deposits stored in the Silo V1 Bean storage is equal to the amount times the
     * initial % recapitalized when Beanstalk was Replanted.
     */

    /**
     * @dev Removes `amount` Unripe Beans stored in the `account` legacy Bean Silo V1 storage
     * and returns the BDV.
     */
    function removeUnripeBeanDeposit(
        address account,
        uint32 season,
        uint256 amount
    ) internal returns (uint256 bdv) {
        _removeUnripeBeanDeposit(account, season, amount);
        bdv = amount.mul(C.initialRecap()).div(1e18);
    }

    /**
     * @dev See {removeUnripeBeanDeposit}.
     */
    function _removeUnripeBeanDeposit(
        address account,
        uint32 season,
        uint256 amount
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].bean.deposits[season] = s.a[account].bean.deposits[season].sub(
            amount,
            "Silo: Crate balance too low."
        );
    }

    /**
     * @dev returns true if the provided address is the Unripe Bean address.
     */
    function isUnripeBean(address token) internal pure returns (bool b) {
        b = token == C.unripeBeanAddress();
    }

    /**
     * @dev Calculate the `amount` and `bdv` of an Unripe Bean deposit.
     */
    function unripeBeanDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].bean.deposits[season];

        // sum the `account` pre-exploit Silo V1 Bean Balance and the Silo V2 Unripe Bean Balance
        amount = uint256(
            s.a[account].deposits[C.unripeBeanAddress()][season].amount
        ).add(legacyAmount);

        // sum the BDV of the `account` pre-exploit Silo V1 Bean Balance and the BDV value stored in the Unripe Bean Silo V2 storage reference.
        // the bdv of the Silo V1 Bean Balance is equal to the amount of Beans haircut by the initial recapitalization percent.
        bdv = uint256(s.a[account].deposits[C.unripeBeanAddress()][season].bdv)
            .add(legacyAmount.mul(C.initialRecap()).div(1e18));
    }

    //////////////////////// Unripe LP ////////////////////////

    /*
     * Unripe LP Deposits stored in the pre-exploit Bean:LUSD and Bean:3Crv Silo V2 and the Bean:Eth legacy Silo V1 storage have not been Enrooted as
     * Enrooting moves the Deposit into the Unripe Bean:3Crv Silo V2 storage reference (See {SiloFacet.enrootDeposit(s)}).
     * Thus, the BDV of Unripe Bean:3Crv Deposits stored in the Silo V1 Bean storage is equal to the BDV of the amount of token times
     * initial % recapitalized when Beanstalk was Replanted.
     */

    /**
     * @notice Removes `amount` Unripe Bean:3Crv stored in any of the pre-exploit LP Token Silo storage mappings
     * and returns the BDV.
     */
    function removeUnripeLPDeposit(
        address account,
        uint32 season,
        uint256 amount
    ) internal returns (uint256 bdv) {
        bdv = _removeUnripeLPDeposit(account, season, amount);
        bdv = bdv.mul(C.initialRecap()).div(1e18);
    }

    /**
     * @notice See {removeUnripeLPDeposit}.
     */
    function _removeUnripeLPDeposit(
        address account,
        uint32 season,
        uint256 amount
    ) private returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Fetch Unripe Bean:3Crv stored in legacy Bean:Eth storage
        (uint256 amount1, uint256 bdv1) = getBeanEthUnripeLP(account, season);
        // If stored amount is less than desired withdraw amount, decrement balances accordingly and return.
        if (amount1 >= amount) {
            // Proportionally decrement the Deposited legacy Bean:Eth Silo balance.
            uint256 removed = amount.mul(s.a[account].lp.deposits[season]).div(amount1);
            s.a[account].lp.deposits[season] = s.a[account].lp.deposits[season].sub(removed);
            removed = amount.mul(bdv1).div(amount1);
            s.a[account].lp.depositSeeds[season] = s
                .a[account]
                .lp
                .depositSeeds[season]
                .sub(removed.mul(4));
            return removed;
        }
        // Else set balance to 0 and decrement `amount` and `bdv` by the amount removed.
        amount -= amount1;
        bdv = bdv1;
        delete s.a[account].lp.depositSeeds[season];
        delete s.a[account].lp.deposits[season];

        // Repeat the process for Unripe Bean:3Crv stored in the pre-exploit Bean:3Crv Silo V2 Deposit storage.
        (amount1, bdv1) = getBean3CrvUnripeLP(account, season);
        if (amount1 >= amount) {
            Account.Deposit storage d = s.a[account].deposits[
                C.unripeLPPool1()
            ][season];
            uint128 removed = uint128(amount.mul(d.amount).div(amount1));
            s.a[account].deposits[C.unripeLPPool1()][season].amount = d.amount.sub(
                removed
            );
            removed = uint128(amount.mul(d.bdv).div(amount1));
            s.a[account].deposits[C.unripeLPPool1()][season].bdv = d.bdv.sub(
                removed
            );
            return bdv.add(removed);
        }
        amount -= amount1;
        bdv = bdv.add(bdv1);
        delete s.a[account].deposits[C.unripeLPPool1()][season];

        // Repeat the process for Unripe Bean:3Crv stored in the pre-exploit Bean:LUSD Silo V2 Deposit storage.
        (amount1, bdv1) = getBeanLusdUnripeLP(account, season);
        if (amount1 >= amount) {
            Account.Deposit storage d = s.a[account].deposits[
                C.unripeLPPool2()
            ][season];
            uint128 removed = uint128(amount.mul(d.amount).div(amount1));
            s.a[account].deposits[C.unripeLPPool2()][season].amount = d.amount.sub(
                removed
            );
            removed = uint128(amount.mul(d.bdv).div(amount1));
            s.a[account].deposits[C.unripeLPPool2()][season].bdv = d.bdv.sub(
                removed
            );
            return bdv.add(removed);
        }
        // Revert if `account` does not have enough Unripe Bean:3Crv across all storage locations.
        revert("Silo: Crate balance too low.");
    }

    /**
     * @notice returns true if the provided address is the Unripe LP address.
     */
    function isUnripeLP(address token) internal pure returns (bool b) {
        b = token == C.unripeLPAddress();
    }

    /**
     * @notice Calculate the `amount` and `bdv` of a give Unripe Bean:3Crv deposit.
     */
    function unripeLPDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Fetch the amount and BDV stored in all 3 pre-exploit LP Silo Deposit storages.
        // See {getBeanEthUnripeLP}, {getBean3CrvUnripeLP} and {getBeanLusdUnripeLP}
        (amount, bdv) = getBeanEthUnripeLP(account, season);
        (uint256 amount1, uint256 bdv1) = getBean3CrvUnripeLP(account, season);
        (uint256 amount2, uint256 bdv2) = getBeanLusdUnripeLP(account, season);

        // Summate the amount acrosses all 4 potential Unripe Bean:3Crv storage locations.
        amount = uint256(
            s.a[account].deposits[C.unripeLPAddress()][season].amount
        ).add(amount.add(amount1).add(amount2));

        // Summate the BDV acrosses all 3 pre-exploit LP Silo Deposit storages and haircut by the inital recapitalization percent.
        uint256 legBdv = bdv.add(bdv1).add(bdv2)
            .mul(C.initialRecap())
            .div(C.precision());
        
        // Summate the pre-exploit legacy bdv and the bdv stored in the Unripe Bean:3Crv Silo Deposit storage.
        bdv = uint256(
            s.a[account].deposits[C.unripeLPAddress()][season].bdv
        ).add(legBdv);
    }

    /**
     * @dev Calculate the `amount` and `bdv` for a Unripe LP deposit stored in Silo V1 LP storage.
     * 
     * In Silo V1, Beanstalk stored the number of Seeds associated with a BEAN:ETH LP Deposit, rather than the BDV.
     * BDV was then derived as `seeds / 4`. 
     * 
     * The BEAN:ETH LP token had a precision of 18 decimals.
     */
    function getBeanEthUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = s.a[account].lp.depositSeeds[season].div(4);
        // `amount` is equal to the pre-exploit BDV of the Deposited Bean:Eth tokens.
        amount = s
            .a[account]
            .lp
            .deposits[season]
            .mul(AMOUNT_TO_BDV_BEAN_ETH)
            .div(1e18);
    }

    /**
     * @dev Calculate the `amount` and `bdv` for a Unripe LP deposit stored in the pre-exploitt Bean:LUSD Silo V2 LP storage.
     * 
     * The BEAN:LUSD LP token had a precision of 18 decimals.
     */
    function getBeanLusdUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = uint256(s.a[account].deposits[C.unripeLPPool2()][season].bdv);
        // `amount` is equal to the pre-exploit BDV of the Deposited Bean:LUSD tokens.
        amount = uint256(
            s.a[account].deposits[C.unripeLPPool2()][season].amount
        ).mul(AMOUNT_TO_BDV_BEAN_LUSD).div(C.precision());
    }

    /**
     * @dev Calculate the `amount` and `bdv` for a Unripe LP deposit stored in the pre-exploit Bean:3Crv Silo V2 LP storage.
     * 
     * The BEAN:3Crv LP token had a precision of 18 decimals.
     */
    function getBean3CrvUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = uint256(s.a[account].deposits[C.unripeLPPool1()][season].bdv);
        // `amount` is equal to the pre-exploit BDV of the Deposited Bean:3Crv tokens.
        amount = uint256(
            s.a[account].deposits[C.unripeLPPool1()][season].amount
        ).mul(AMOUNT_TO_BDV_BEAN_3CRV).div(C.precision());
    }
}
