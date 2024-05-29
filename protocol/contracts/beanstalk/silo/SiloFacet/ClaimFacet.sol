/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;
pragma abicoder v2;

import {C} from "contracts/C.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibWell, IWell} from "contracts/libraries/Well/LibWell.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";

/**
 * @title ClaimFacet
 * @author pizzaman1337, brean
 * @notice ClaimFacet contains functions for claiming rewards from beanstalk.
 */
contract ClaimFacet is Invariable, ReentrancyGuard {
    using LibRedundantMath256 for uint256;
    /**
     * @notice Emitted when Token paid to `account` during a Flood is Claimed.
     * @param account Owns and receives the assets paid during a Flood.
     * @param plenty The amount of Token claimed by `account`. This is the amount
     * that `account` has been paid since their last {ClaimPlenty}.
     *
     * @dev Flood was previously called a "Season of Plenty". For backwards
     * compatibility, the event has not been changed. For more information on
     * Flood, see: {Weather.sop}.
     */
    event ClaimPlenty(address indexed account, address token, uint256 plenty);

    /**
     * @notice Emitted when the deposit associated with the Earned Beans of
     * `account` are Planted.
     * @param account Owns the Earned Beans
     * @param beans The amount of Earned Beans claimed by `account`.
     */
    event Plant(address indexed account, uint256 beans);

    /**
     * @notice Emitted when `account` gains or loses Stalk.
     * @param account The account that gained or lost Stalk.
     * @param delta The change in Stalk.
     * @param deltaRoots The change in Roots.
     *
     * @dev {StalkBalanceChanged} should be emitted anytime a Deposit is added, removed or transferred AND
     * anytime an account Mows Grown Stalk.
     * @dev BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     * [BIP-24](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/bip-24-fungible-bdv-support.md)
     * [Event-24-Event-Emission](https://github.com/BeanstalkFarms/Event-24-Event-Emission)
     */
    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);

    /**
     * @notice Claim rewards from a Flood (Was Season of Plenty)
     */
    function claimPlenty(
        address well,
        LibTransfer.To toMode
    )
        external
        payable
        fundsSafu
        noSupplyChange
        oneOutFlow(address(LibWell.getNonBeanTokenFromWell(well)))
        nonReentrant
    {
        _claimPlenty(LibTractor._user(), well, toMode);
    }

    function claimAllPlenty(
        LibTransfer.To toMode
    ) external payable fundsSafu noSupplyChange nonReentrant {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint i; i < tokens.length; i++) {
            _claimPlenty(LibTractor._user(), tokens[i], toMode);
        }
    }

    //////////////////////// INTERNAL: SEASON OF PLENTY ////////////////////////

    /**
     * @dev Gas optimization: An account can call `{SiloFacet:claimPlenty}` even
     * if `s.accts[account].sop.plenty == 0`. This would emit a ClaimPlenty event
     * with an amount of 0.
     */
    function _claimPlenty(address account, address well, LibTransfer.To toMode) internal {
        uint256 plenty = s.accts[account].sop.perWellPlenty[well].plenty;
        if (plenty > 0 && LibWell.isWell(well)) {
            IERC20[] memory tokens = IWell(well).tokens();
            IERC20 sopToken = tokens[0] != C.bean() ? tokens[0] : tokens[1];
            LibTransfer.sendToken(sopToken, plenty, LibTractor._user(), toMode);
            s.accts[account].sop.perWellPlenty[well].plenty = 0;

            // reduce from Beanstalk's total stored plenty for this well
            s.sys.sop.plentyPerSopToken[address(sopToken)] -= plenty;

            emit ClaimPlenty(account, address(sopToken), plenty);
        }
    }

    //////////////////////// YIELD DISTRUBUTION ////////////////////////

    /**
     * @notice Claim Grown Stalk for `account`.
     * @dev See {Silo-_mow}.
     */
    function mow(
        address account,
        address token
    ) external payable fundsSafu noNetFlow noSupplyChange {
        LibSilo._mow(account, token);
    }

    //function to mow multiple tokens given an address
    function mowMultiple(
        address account,
        address[] calldata tokens
    ) external payable fundsSafu noNetFlow noSupplyChange {
        for (uint256 i; i < tokens.length; ++i) {
            LibSilo._mow(account, tokens[i]);
        }
    }

    /**
     * @notice Claim Earned Beans and their associated Stalk and Plantable Seeds for
     * user.
     *
     * The Stalk associated with Earned Beans is commonly called "Earned Stalk".
     * Earned Stalk DOES contribute towards the Farmer's Stalk when earned beans is issued.
     *
     * The Seeds associated with Earned Beans are commonly called "Plantable
     * Seeds". The word "Plantable" is used to highlight that these Seeds aren't
     * yet earning the Farmer new Stalk. In other words, Seeds do NOT automatically
     * compound; they must first be Planted with {plant}.
     *
     * In practice, when Seeds are Planted, all Earned Beans are Deposited in
     * the current Season.
     */
    function plant()
        external
        payable
        fundsSafu
        noNetFlow
        noSupplyChange
        returns (uint256 beans, int96 stem)
    {
        return _plant(LibTractor._user());
    }

    //////////////////////// INTERNAL: PLANT ////////////////////////

    /**
     * @dev Plants the Plantable BDV of `account` associated with its Earned
     * Beans.
     *
     * For more info on Planting, see: {SiloFacet-plant}
     */

    function _plant(address account) internal returns (uint256 beans, int96 stemTip) {
        // Need to Mow for `account` before we calculate the balance of
        // Earned Beans.

        LibSilo._mow(account, C.BEAN);
        uint256 accountStalk = s.accts[account].stalk;

        // Calculate balance of Earned Beans.
        beans = LibSilo._balanceOfEarnedBeans(accountStalk, s.accts[account].roots);
        stemTip = LibTokenSilo.stemTipForToken(C.BEAN);
        if (beans == 0) return (0, stemTip);

        // Reduce the Silo's supply of Earned Beans.
        // SafeCast unnecessary because beans is <= s.sys.silo.earnedBeans.
        s.sys.silo.earnedBeans = s.sys.silo.earnedBeans.sub(uint128(beans));

        // Deposit Earned Beans if there are any. Note that 1 Bean = 1 BDV.
        LibTokenSilo.addDepositToAccount(
            account,
            C.BEAN,
            stemTip,
            beans, // amount
            beans, // bdv
            LibTokenSilo.Transfer.emitTransferSingle
        );

        // Earned Stalk associated with Earned Beans generate more Earned Beans automatically (i.e., auto compounding).
        // Earned Stalk are minted when Earned Beans are minted during Sunrise. See {Sun.sol:rewardToSilo} for details.
        // Similarly, `account` does not receive additional Roots from Earned Stalk during a Plant.
        // The following lines allocate Earned Stalk that has already been minted to `account`.
        // Constant is used here rather than s.sys.silo.assetSettings[BEAN].stalkIssuedPerBdv
        // for gas savings.
        uint256 stalk = beans.mul(C.STALK_PER_BEAN);
        s.accts[account].stalk = accountStalk.add(stalk);

        emit StalkBalanceChanged(account, int256(stalk), 0);
        emit Plant(account, beans);
    }
}
