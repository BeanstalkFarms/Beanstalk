/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibChop} from "contracts/libraries/LibChop.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibLockedUnderlying} from "contracts/libraries/LibLockedUnderlying.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title UnripeFacet
 * @author ZrowGz, Publius, deadmanwalking
 * @notice Handles functionality related to Unripe Tokens including Chopping, Picking,
 * managing Unripe Tokens. Also, contains view functions to fetch Unripe Token data.
 */

contract UnripeFacet is Invariable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using LibRedundantMath256 for uint256;

    /**
     * @notice Emitted when a new unripe token is added to Beanstalk.
     */
    event AddUnripeToken(
        address indexed unripeToken,
        address indexed underlyingToken,
        bytes32 merkleRoot
    );

    /**
     * @notice Emitted when the Ripe Token of an Unripe Token increases or decreases.
     * @param token The token of which the Underlying changes.
     * @param underlying `amount` that has changed.
     */
    event ChangeUnderlying(address indexed token, int256 underlying);

    /**
     * @notice Emitted when the Ripe Token of an unripe asset changes.
     * @param token The Unripe Token to change the Ripe Token of.
     * @param underlyingToken The new Ripe Token.
     */
    event SwitchUnderlyingToken(address indexed token, address indexed underlyingToken);

    /**
     * @notice emitted when a Farmer Chops.
     */
    event Chop(address indexed account, address indexed token, uint256 amount, uint256 underlying);

    /**
     * @notice emitted when a user `picks`.
     * @dev `picking` is claiming non-Deposited Unripe Tokens.
     */
    event Pick(address indexed account, address indexed token, uint256 amount);

    /**
     * @notice Chops an unripe asset into its ripe counterpart according to the recapitalization %
     * @param unripeToken The address of the unripe token to be chopped into its ripe counterpart
     * @param amount The amount of the of the unripe token to be chopped into its ripe counterpart
     * @param fromMode Enum value to distinguish the type of account used to charge the funds before chopping.
     * @param toMode Enum value to distinguish the type of account used to credit the funds after chopping.
     * fromMode can be EXTERNAL,INTERNAL, EXTERNAL_INTERNAL,INTERNAL_TOLERANT.
     * toMode can be EXTERNAL or INTERNAL.
     * @return underlyingAmount the amount of ripe tokens received after the chop
     */
    function chop(
        address unripeToken,
        uint256 amount,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable fundsSafu noSupplyChange nonReentrant returns (uint256) {
        // burn the token from the user address
        uint256 supply = IBean(unripeToken).totalSupply();
        amount = LibTransfer.burnToken(IBean(unripeToken), amount, LibTractor._user(), fromMode);
        // get ripe address and ripe amount
        (address underlyingToken, uint256 underlyingAmount) = LibChop.chop(
            unripeToken,
            amount,
            supply
        );
        // send the corresponding amount of ripe token to the user address
        require(underlyingAmount > 0, "Chop: no underlying");
        IERC20(underlyingToken).sendToken(underlyingAmount, LibTractor._user(), toMode);
        // emit the event
        emit Chop(LibTractor._user(), unripeToken, amount, underlyingAmount);
        return underlyingAmount;
    }

    /**
     * @notice Returns the amount of Ripe Tokens that underly a given amount of Unripe Tokens.
     * @dev Does NOT include the penalty associated with the percent of Sprouts that are Rinsable
     * or Rinsed.
     * @param unripeToken The address of the Unripe Token.
     * @param amount The amount of the Unripe Token.
     * @return underlyingAmount The amount of Ripe Tokens that underly the given amount of
     * Unripe Tokens.
     */
    function getUnderlying(
        address unripeToken,
        uint256 amount
    ) public view returns (uint256 underlyingAmount) {
        return LibUnripe.unripeToUnderlying(unripeToken, amount, IBean(unripeToken).totalSupply());
    }

    /**
     * @notice Getter function to get the corresponding penalty associated with an unripe asset.
     * @param unripeToken The address of the unripe token.
     * @return penalty The current penalty for converting unripe --> ripe
     */
    function getPenalty(address unripeToken) external view returns (uint256 penalty) {
        return getPenalizedUnderlying(unripeToken, LibUnripe.DECIMALS);
    }

    /**
     * @notice Getter function to get the corresponding amount
     * of ripe tokens from a set amount of unripe tokens according to current state.
     * @param unripeToken The address of the unripe token.
     * @param amount The amount of the unripe token.
     * @return redeem The amount of the corresponding ripe tokens
     */
    function getPenalizedUnderlying(
        address unripeToken,
        uint256 amount
    ) public view returns (uint256 redeem) {
        return
            LibUnripe._getPenalizedUnderlying(
                unripeToken,
                amount,
                IBean(unripeToken).totalSupply()
            );
    }

    function _getPenalizedUnderlying(
        address unripeToken,
        uint256 amount,
        uint256 supply
    ) public view returns (uint256 redeem) {
        return LibUnripe._getPenalizedUnderlying(unripeToken, amount, supply);
    }

    /**
     * @notice Returns whether a token is an Unripe Token.
     * @param unripeToken The token address to check.
     * @return unripe Whether the token is Unripe or not.
     */
    function isUnripe(address unripeToken) external view returns (bool unripe) {
        unripe = LibUnripe.isUnripe(unripeToken);
    }

    /**
     * @notice Returns the amount of Ripe Tokens that underly a Farmer's balance of Unripe
     * Tokens.
     * @param unripeToken The address of the Unripe Token.
     * @param account The address of the Farmer to check.
     * @return underlying The amount of Ripe Tokens that underly the Farmer's balance.
     */
    function balanceOfUnderlying(
        address unripeToken,
        address account
    ) external view returns (uint256 underlying) {
        return getUnderlying(unripeToken, IERC20(unripeToken).balanceOf(account));
    }

    /**
     * @notice Returns the amount of Ripe Tokens that underly a Farmer's balance of Unripe
     * @param unripeToken The address of the unripe token.
     * @param account The address of the account to check.
     * @return underlying The theoretical amount of the ripe asset in the account.
     */
    function balanceOfPenalizedUnderlying(
        address unripeToken,
        address account
    ) external view returns (uint256 underlying) {
        return getPenalizedUnderlying(unripeToken, IERC20(unripeToken).balanceOf(account));
    }

    /**
     * @notice Returns the % of Ripe Tokens that have been recapiatlized for a given Unripe Token.
     * @param unripeToken The address of the Unripe Token.
     * @return percent The recap % of the token.
     */
    function getRecapFundedPercent(address unripeToken) public view returns (uint256 percent) {
        if (unripeToken == C.UNRIPE_BEAN) {
            return LibUnripe.percentBeansRecapped();
        } else if (unripeToken == C.UNRIPE_LP) {
            return LibUnripe.percentLPRecapped();
        }
        revert("not vesting");
    }

    /**
     * @notice Returns the % penalty of Chopping an Unripe Token into its Ripe Token.
     * @param unripeToken The address of the Unripe Token.
     * @return penalty The penalty % of Chopping.
     */
    function getPercentPenalty(address unripeToken) external view returns (uint256 penalty) {
        return LibUnripe.getRecapPaidPercentAmount(getRecapFundedPercent(unripeToken));
    }

    /**
     * @notice Returns % of Sprouts that are Rinsable or Rinsed.
     * @return percent The % stemming from the recap.
     */
    function getRecapPaidPercent() external view returns (uint256 percent) {
        percent = LibUnripe.getRecapPaidPercentAmount(LibUnripe.DECIMALS);
    }

    /**
     * @notice Returns the amount of Ripe Tokens that underly a single Unripe Token.
     * @dev has 6 decimals of precision.
     * @param unripeToken The address of the unripe token.
     * @return underlyingPerToken The underlying ripe token per unripe token.
     */
    function getUnderlyingPerUnripeToken(
        address unripeToken
    ) external view returns (uint256 underlyingPerToken) {
        underlyingPerToken = s
            .sys
            .silo
            .unripeSettings[unripeToken]
            .balanceOfUnderlying
            .mul(LibUnripe.DECIMALS)
            .div(IERC20(unripeToken).totalSupply());
    }

    /**
     * @notice Returns the total amount of Ripe Tokens for a given Unripe Token.
     * @param unripeToken The address of the unripe token.
     * @return underlying The total balance of the token.
     */
    function getTotalUnderlying(address unripeToken) external view returns (uint256 underlying) {
        return s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying;
    }

    /**
     * @notice Adds an Unripe Token to Beanstalk.
     * @param unripeToken The address of the Unripe Token to be added.
     * @param underlyingToken The address of the Ripe Token.
     * @param root The merkle root, which is used to verify claims.
     */
    function addUnripeToken(
        address unripeToken,
        address underlyingToken,
        bytes32 root
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        LibDiamond.enforceIsOwnerOrContract();
        s.sys.silo.unripeSettings[unripeToken].underlyingToken = underlyingToken;
        emit AddUnripeToken(unripeToken, underlyingToken, root);
    }

    /**
     * @notice Returns the Ripe Token of an Unripe Token.
     * @param unripeToken The address of the Unripe Token.
     * @return underlyingToken The address of the Ripe Token.
     */
    function getUnderlyingToken(
        address unripeToken
    ) external view returns (address underlyingToken) {
        return LibUnripe._getUnderlyingToken(unripeToken);
    }

    /////////////// UNDERLYING TOKEN MIGRATION //////////////////

    /**
     * @notice Adds Ripe Tokens to an Unripe Token. Used when changing the Ripe Token.
     * @param unripeToken The Unripe Token to add Underlying tokens to.
     * @param amount The amount of Ripe Tokens to add.
     * @dev Used to migrate the Ripe Token of an Unripe Token to a new token.
     * Only callable by the contract owner.
     */
    function addMigratedUnderlying(
        address unripeToken,
        uint256 amount
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        LibDiamond.enforceIsContractOwner();
        IERC20(s.sys.silo.unripeSettings[unripeToken].underlyingToken).safeTransferFrom(
            LibTractor._user(),
            address(this),
            amount
        );
        LibUnripe.incrementUnderlying(unripeToken, amount);
    }

    /**
     * @notice Switches the Ripe Token of an Unripe Token.
     * @param unripeToken The Unripe Token to switch the Ripe Token of.
     * @param newUnderlyingToken The new Ripe Token to switch to.
     * @dev `s.silo.unripeSettings[unripeToken].balanceOfUnderlying` must be 0.
     */
    function switchUnderlyingToken(
        address unripeToken,
        address newUnderlyingToken
    ) external payable fundsSafu noNetFlow noSupplyChange {
        LibDiamond.enforceIsContractOwner();
        require(
            s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying == 0,
            "Unripe: Underlying balance > 0"
        );
        LibUnripe.switchUnderlyingToken(unripeToken, newUnderlyingToken);
    }

    /**
     * @notice Returns the number of Beans that are locked (not in circulation) using the TWA reserves in
     * the Bean:Eth Well including the Unchoppable Beans underlying the Unripe Bean and Unripe LP
     * Tokens.
     */
    function getLockedBeans() external view returns (uint256) {
        uint256[] memory twaReserves = LibWell.getTwaReservesFromPump(
            LibBarnRaise.getBarnRaiseWell()
        );
        return LibUnripe.getLockedBeans(twaReserves);
    }

    /**
     * @notice Returns the number of Beans that are locked underneath the Unripe Bean token.
     */
    function getLockedBeansUnderlyingUnripeBean() external view returns (uint256) {
        return
            LibLockedUnderlying.getLockedUnderlying(
                C.UNRIPE_BEAN,
                LibUnripe.getRecapPaidPercentAmount(1e6)
            );
    }

    /**
     * @notice Returns the number of Beans that are locked underneath the Unripe LP Token.
     */
    function getLockedBeansUnderlyingUnripeLP() external view returns (uint256) {
        uint256[] memory twaReserves = LibWell.getTwaReservesFromPump(
            LibBarnRaise.getBarnRaiseWell()
        );
        return LibUnripe.getLockedBeansFromLP(twaReserves);
    }
}
