/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import {MerkleProof} from "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {C} from "contracts/C.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibLockedUnderlying} from "contracts/libraries/LibLockedUnderlying.sol";
import {LibChop} from "contracts/libraries/LibChop.sol";

/**
 * @title UnripeFacet
 * @author ZrowGz, Publius, deadmanwalking
 * @notice Handles functionality related to Unripe Tokens including Chopping, Picking,
 * managing Unripe Tokens. Also, contains view functions to fetch Unripe Token data.
 */

contract UnripeFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using SafeMath for uint256;

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
    ) external payable nonReentrant returns (uint256) {
        // burn the token from the msg.sender address
        uint256 supply = IBean(unripeToken).totalSupply();
        amount = LibTransfer.burnToken(IBean(unripeToken), amount, msg.sender, fromMode);
        // get ripe address and ripe amount
        (address underlyingToken, uint256 underlyingAmount) = LibChop.chop(
            unripeToken,
            amount,
            supply
        );
        // send the corresponding amount of ripe token to the user address
        require(underlyingAmount > 0, "Chop: no underlying");
        IERC20(underlyingToken).sendToken(underlyingAmount, msg.sender, toMode);
        // emit the event
        emit Chop(msg.sender, unripeToken, amount, underlyingAmount);
        return underlyingAmount;
    }

    /**
     * @notice Picks a Farmer's Pickable Unripe Tokens.
     * @dev Pickable Unripe Tokens were distributed to all non-Deposited pre-exploit Bean and Bean LP Tokens.
     * @param token The Unripe Token address to Pick.
     * @param amount The amount of Unripe Tokens to Pick.
     * @param proof The merkle proof used to validate that the Pick is valid.
     * @param mode The destination balance that the Unripe Tokens are sent to.
     */
    function pick(
        address token,
        uint256 amount,
        bytes32[] memory proof,
        LibTransfer.To mode
    ) external payable nonReentrant {
        bytes32 root = s.u[token].merkleRoot;
        require(root != bytes32(0), "UnripeClaim: invalid token");
        require(!picked(msg.sender, token), "UnripeClaim: already picked");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(proof, root, leaf), "UnripeClaim: invalid proof");
        s.unripeClaimed[token][msg.sender] = true;

        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);

        emit Pick(msg.sender, token, amount);
    }

    /**
     * @notice Returns whether a given `account` has picked a given `token`.
     * @param account The address of the account to check.
     * @param token The address of the Unripe Token to check.
     */
    function picked(address account, address token) public view returns (bool) {
        return s.unripeClaimed[token][account];
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
            LibUnripe._getPenalizedUnderlying(unripeToken, amount, IBean(unripeToken).totalSupply());
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
    function getUnderlyingPerUnripeToken(address unripeToken)
        external
        view
        returns (uint256 underlyingPerToken)
    {
        underlyingPerToken = s
            .u[unripeToken]
            .balanceOfUnderlying
            .mul(LibUnripe.DECIMALS)
            .div(IERC20(unripeToken).totalSupply());
    }

    /**
     * @notice Returns the total amount of Ripe Tokens for a given Unripe Token.
     * @param unripeToken The address of the unripe token.
     * @return underlying The total balance of the token. 
     */
    function getTotalUnderlying(address unripeToken)
        external
        view
        returns (uint256 underlying)
    {
        return s.u[unripeToken].balanceOfUnderlying;
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
    ) external payable nonReentrant {
        LibDiamond.enforceIsOwnerOrContract();
        s.u[unripeToken].underlyingToken = underlyingToken;
        s.u[unripeToken].merkleRoot = root;
        emit AddUnripeToken(unripeToken, underlyingToken, root);
    }

    /**
     * @notice Returns the Ripe Token of an Unripe Token.
     * @param unripeToken The address of the Unripe Token.
     * @return underlyingToken The address of the Ripe Token.
     */
    function getUnderlyingToken(address unripeToken)
        external
        view
        returns (address underlyingToken)
    {
        return s.u[unripeToken].underlyingToken;
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
    ) external payable nonReentrant {
        LibDiamond.enforceIsContractOwner();
        IERC20(s.u[unripeToken].underlyingToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        LibUnripe.incrementUnderlying(unripeToken, amount);
    }

    /**
     * @notice Switches the Ripe Token of an Unripe Token.
     * @param unripeToken The Unripe Token to switch the Ripe Token of.
     * @param newUnderlyingToken The new Ripe Token to switch to.
     * @dev `s.u[unripeToken].balanceOfUnderlying` must be 0.
     */
    function switchUnderlyingToken(
        address unripeToken,
        address newUnderlyingToken
    ) external payable {
        LibDiamond.enforceIsContractOwner();
        require(s.u[unripeToken].balanceOfUnderlying == 0, "Unripe: Underlying balance > 0");
        LibUnripe.switchUnderlyingToken(unripeToken, newUnderlyingToken);
    }

    /**
     * @notice Returns the number of Beans that are locked (not in circulation) using the TWA reserves in
     * the Bean:Eth Well including the Unchoppable Beans underlying the Unripe Bean and Unripe LP
     * Tokens.
     */
    function getLockedBeans() external view returns (uint256) {
        uint256[] memory twaReserves = LibWell.getTwaReservesFromBeanstalkPump(C.BEAN_ETH_WELL);
        return LibUnripe.getLockedBeans(twaReserves);
    }

    /**
     * @notice returns the locked beans given the cumulative reserves and timestamp.
     */
    function getLockedBeansFromTwaReserves(
        bytes memory cumulativeReserves,
        uint40 timestamp
    ) external view returns (uint256) {
        address underlyingUrLpWell = s.u[C.UNRIPE_LP].underlyingToken;
        uint256[] memory twaReserves = LibWell.getTwaReservesFromPump(
            underlyingUrLpWell,
            cumulativeReserves,
            timestamp
        );
        return LibUnripe.getLockedBeans(twaReserves);
    }

    /**
     * @notice Returns the number of Beans that are locked underneath the Unripe Bean token.
     */
    function getLockedBeansUnderlyingUnripeBean() external view returns (uint256) {
        return LibLockedUnderlying.getLockedUnderlying(
            C.UNRIPE_BEAN,
            LibUnripe.getRecapPaidPercentAmount(1e6)
        );
    }

    /**
     * @notice Returns the number of Beans that are locked underneath the Unripe LP Token.
     */
    function getLockedBeansUnderlyingUnripeBeanEth() external view returns (uint256) {
        uint256[] memory twaReserves = LibWell.getTwaReservesFromBeanstalkPump(C.BEAN_ETH_WELL);
        return LibUnripe.getLockedBeansFromLP(twaReserves);
    }
}
