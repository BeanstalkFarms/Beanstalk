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
 * @title LibUnripeSilo
 * @author Publius
 * @notice Contains functions for interacting with Unripe Silo deposits.
 * Provides a unified interface that works across legacy storage references.
 * 
 * @dev Beanstalk was exploited on April 17, 2022. All tokens that existed at
 * this time, including whitelisted LP tokens, are now defunct and referred to 
 * as "legacy" or "pre-exploit" tokens.
 *
 * Legacy token addresses are listed here:
 * https://docs.bean.money/almanac/protocol/contracts#pre-exploit-contracts
 *
 * When Beanstalk was Replanted on Aug 6, 2022, new two tokens — Unripe Bean and 
 * Unripe BEAN:3CRV — were created and whitelisted in the Silo. See {Replant8-init}.
 * 
 * At the time of exploit, there were three forms of LP whitelisted in the Silo:
 * BEAN:ETH, BEAN:3CRV, and BEAN:LUSD. However, only one LP token was created
 * during the Replant: BEAN:3CRV (at a new address). 
 * 
 * Existing Bean and LP Depositors were credited with Unripe Bean Deposits and 
 * Unripe BEAN:3CRV Deposits respectively, equal to the BDV of each Deposit
 * at the end of the pre-exploit block.
 * 
 * {Replant7-init} migrated the Deposits through events by emitting:
 *  1. {RemoveSeason(s)} or {LPRemove} for Bean and LP Deposits
 *  2. {AddDeposit} for Unripe Bean and Unripe LP distributions
 * 
 * This operation was performed for all accounts with Silo Deposits to prevent
 * users from being required to perform a manual migration (and thus pay gas).
 * 
 * However, moving all on-chain Bean Deposit storage variables to the Silo V2 
 * storage mapping during {Replant7-init} was prohibitively expensive.
 *
 * This library remaps pre-exploit Bean and LP Deposit storage references to
 * Unripe Bean and Unripe BEAN:3CRV Deposits. New Unripe Bean and Unripe 
 * BEAN:3CRV Deposits are stored in the expected Silo V2 storage location.
 */
library LibUnripeSilo {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    /*
     * The values below represent the {LibTokenSilo-beanDenominatedValue} of 
     * each pre-exploit LP token at the end of Block 14602789 (the block before 
     * the exploit).
     * 
     * {LibUnripeSilo} uses these constants to migrate pre-exploit LP Deposits.
     * 
     * Note that the BDV of BEAN itself is always 1, hence why only LP tokens
     * appear below.
     */
    
    uint256 private constant AMOUNT_TO_BDV_BEAN_ETH = 119_894_802_186_829; // 18 decimal precision
    uint256 private constant AMOUNT_TO_BDV_BEAN_3CRV = 992_035; // 6 decimal precision
    uint256 private constant AMOUNT_TO_BDV_BEAN_LUSD = 983_108; // 6 decimal precision

    //////////////////////// Unripe BEAN ////////////////////////

    /*
     * Unripe Bean Deposits stored in the Silo V1 Bean storage reference have
     * not yet been Enrooted, as Enrooting moves the Deposit into the Unripe Bean
     * Silo V2 storage reference (See {SiloFacet-enrootDeposit(s)}).
     * 
     * Thus, the BDV of Unripe Bean Deposits stored in the Silo V1 Bean storage 
     * is equal to the amount deposited times the initial % recapitalized when 
     * Beanstalk was Replanted.
     *
     * As Beanstalk continues to recapitalize, users can call 
     * {SiloFacet-enrootDeposit(s)} to update the BDV of their Unripe Deposits. 
     */

    /**
     * @dev Removes `amount` of Unripe Beans deposited stored in `account` legacy 
     * Silo V1 storage and returns the BDV.
     *
     * Since Deposited Beans have a BDV of 1, 1 Bean in Silo V1 storage equals
     * 1 Unripe Bean. 
     *
     * FIXME(naming): removeLegacyDepositAsUnripeBean ?
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
     * 
     * FIXME(naming): _removeLegacyDepositAsUnripeBean ?
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
     * @dev Returns true if the provided address is the Unripe Bean address.
     */
    function isUnripeBean(address token) internal pure returns (bool b) {
        b = token == C.unripeBeanAddress();
    }

    /**
     * @dev Calculate the `amount` and `bdv` of an Unripe Bean deposit. Sums
     * across the amounts stored in Silo V1 and Silo V2 storage.
     * 
     * This is Unripe Bean equivalent of {LibTokenSilo-tokenDeposit}.
     */
    function unripeBeanDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].bean.deposits[season];

        // Sum the `account` pre-exploit Silo V1 Bean Balance 
        // and the Silo V2 Unripe Bean Balance
        amount = uint256(
            s.a[account].deposits[C.unripeBeanAddress()][season].amount
        ).add(legacyAmount);

        // Sum the BDV of the `account` pre-exploit Silo V1 Bean Balance 
        // and the BDV value stored in the Unripe Bean Silo V2 storage reference.
        //
        // The BDV of the Silo V1 Bean Balance is equal to the amount of Beans
        // (where 1 Bean = 1 BDV) times the initial recapitalization percent.
        bdv = uint256(s.a[account].deposits[C.unripeBeanAddress()][season].bdv)
            .add(legacyAmount.mul(C.initialRecap()).div(1e18));
    }

    //////////////////////// Unripe LP ////////////////////////

    /*
     * Unripe LP Deposits stored in the pre-exploit Bean:LUSD and BEAN:3CRV Silo
     * V2 and the BEAN:ETH legacy Silo V1 storage have not been Enrooted, as
     * Enrooting moves the Deposit into the Unripe BEAN:3CRV Silo V2 storage 
     * reference (See {SiloFacet.enrootDeposit(s)}).
     * 
     * Thus, the BDV of Unripe BEAN:3CRV Deposits stored in the Silo V1 Bean
     * storage is equal to the BDV of the amount of token times initial
     * % recapitalized when Beanstalk was Replanted.
     */

    /**
     * @dev Removes `amount` Unripe BEAN:3CRV stored in _any_ of the
     * pre-exploit LP Token Silo storage mappings and returns the BDV. 
     *
     * Priorization:
     * 
     * 1. Silo V1 format, pre-exploit BEAN:ETH LP token
     * 2. Silo V2 format, pre-exploit BEAN:3CRV LP token
     * 3. Silo V2 format, pre-exploit BEAN:LUSD LP token
     *
     * Should loop through each of the storage formats in the above order and
     * remove from each as necessary. A contrived example:
     * 
     * +─────────+─────────+─────────────────+─────────────────────────+
     * | season  | amount  | bdv at exploit  | token                   |
     * +─────────+─────────+─────────────────+─────────────────────────+
     * | 6044    | 0.00001 | 500             | BEAN:ETH (pre-exploit)  |
     * | 6044    | 600     | 610             | BEAN:3CRV (pre-exploit) |
     * | 6044    | 300     | 290             | BEAN:LUSD (pre-exploit) |
     * +─────────+─────────+─────────────────+─────────────────────────+
     *
     * With the above Deposits, the user should have received:
     *  500 + 610 + 290 = 1400 Unripe BEAN:3CRV LP.
     *
     * Removing 600 Unripe BEAN:3CRV LP would remove all 500 from the pre-exploit
     * BEAN:ETH Deposit and bring the pre-exploit BEAN:3CRV Deposit from
     * 610 -> 510.
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
     * @dev See {removeUnripeLPDeposit}.
     *
     * Note that 1 Unripe LP = 1 BDV at the block of exploit.
     */
    function _removeUnripeLPDeposit(
        address account,
        uint32 season,
        uint256 amount
    ) private returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Fetch Unripe BEAN:3CRV stored in legacy BEAN:ETH storage 
        // (Silo V1 format).
        (uint256 amount1, uint256 bdv1) = getBeanEthUnripeLP(account, season);

        // If the amount in legacy BEAN:ETH storage is more than the desired 
        // withdraw amount, decrement balances accordingly and return.
        if (amount1 >= amount) {
            // Proportionally decrement the Deposited legacy BEAN:ETH Silo balance.
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

        // Use the entire legacy BEAN:ETH balance.
        amount -= amount1;
        bdv = bdv1;
        delete s.a[account].lp.depositSeeds[season];
        delete s.a[account].lp.deposits[season];

        // Fetch Unripe BEAN:3CRV stored in the legacy BEAN:3CRV Deposit storage 
        // (Silo V2 format).
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

        // Use the entire legacy BEAN:3CRV balance.
        amount -= amount1;
        bdv = bdv.add(bdv1);
        delete s.a[account].deposits[C.unripeLPPool1()][season];

        // Fetch Unripe BEAN:3CRV stored in the legacy BEAN:LUSD Deposit storage
        // (Silo V2 format).
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

        // Revert if `account` does not have enough Unripe BEAN:3CRV across all storage locations.
        revert("Silo: Crate balance too low.");
    }

    /**
     * @dev Returns true if the provided address is the Unripe LP token address.
     */
    function isUnripeLP(address token) internal pure returns (bool b) {
        b = token == C.unripeLPAddress();
    }

    /**
     * @dev Calculate the `amount` and `bdv` of a given Unripe BEAN:3CRV deposit.
     *
     * This is Unripe LP equivalent of {LibTokenSilo-tokenDeposit}.
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

        // Summate the amount acrosses all 4 potential Unripe BEAN:3CRV storage locations.
        amount = uint256(
            s.a[account].deposits[C.unripeLPAddress()][season].amount
        ).add(amount.add(amount1).add(amount2));

        // Summate the BDV acrosses all 3 pre-exploit LP Silo Deposit storages
        // and haircut by the inital recapitalization percent.
        uint256 legBdv = bdv.add(bdv1).add(bdv2)
            .mul(C.initialRecap())
            .div(C.precision());
        
        // Summate the pre-exploit legacy BDV and the BDV stored in the
        // Unripe BEAN:3CRV Silo Deposit storage.
        bdv = uint256(
            s.a[account].deposits[C.unripeLPAddress()][season].bdv
        ).add(legBdv);
    }

    /*
     * For the following `get*LP()` functions, make note:
     * 
     * @return amount The amount of _Unripe LP_ associated with the pre-exploit 
     * Deposit. Does NOT equal the amount of tokens in the Deposit. Instead,
     * this equals the BDV of all tokens in in this Deposit _at the block 
     * Beanstalk was exploited_.
     * @return bdv The BDV contained in the pre-exploit Deposit.
     */

    /**
     * @dev Calculate the `amount` and `bdv` for a Unripe LP deposit stored in
     * the pre-exploit BEAN:ETH storage location (Silo V1 format).
     *
     * Note: In Silo V1, Beanstalk stored the number of Seeds associated with a 
     * BEAN:ETH LP Deposit instead of the BDV. BDV was then derived as 
     * `seeds / 4`. 
     * 
     * The legacy BEAN:ETH LP token had a precision of 18 decimals.
     */
    function getBeanEthUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = s.a[account].lp.depositSeeds[season].div(4);

        // `amount` is equal to the pre-exploit BDV of the Deposited BEAN:ETH
        // tokens. This is the equivalent amount of Unripe BEAN:3CRV LP.
        amount = s
            .a[account]
            .lp
            .deposits[season]
            .mul(AMOUNT_TO_BDV_BEAN_ETH)
            .div(1e18);
    }

    /**
     * @dev Calculate the `amount` and `bdv` for a Unripe LP deposit stored in
     * the pre-exploit BEAN:LUSD storage location (Silo V2 format).
     * 
     * The legacy BEAN:LUSD LP token had a precision of 18 decimals.
     */
    function getBeanLusdUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = uint256(s.a[account].deposits[C.unripeLPPool2()][season].bdv);

        // `amount` is equal to the pre-exploit BDV of the Deposited BEAN:LUSD
        // tokens. This is the equivalent amount of Unripe BEAN:3CRV LP.
        amount = uint256(
            s.a[account].deposits[C.unripeLPPool2()][season].amount
        ).mul(AMOUNT_TO_BDV_BEAN_LUSD).div(C.precision());
    }

    /**
     * @dev Calculate the `amount` and `bdv` for a Unripe LP deposit stored in 
     * the pre-exploit BEAN:3CRV storage location (Silo V2 format).
     * 
     * The legacy BEAN:3CRV LP token had a precision of 18 decimals.
     */
    function getBean3CrvUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = uint256(s.a[account].deposits[C.unripeLPPool1()][season].bdv);

        // `amount` is equal to the pre-exploit BDV of the Deposited BEAN:3CRV
        // tokens. This is the equivalent amount of Unripe BEAN:3CRV LP.
        amount = uint256(
            s.a[account].deposits[C.unripeLPPool1()][season].amount
        ).mul(AMOUNT_TO_BDV_BEAN_3CRV).div(C.precision());
    }
}
