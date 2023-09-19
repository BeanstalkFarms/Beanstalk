/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import "contracts/C.sol";
import "contracts/beanstalk/ReentrancyGuard.sol";
import "contracts/libraries/LibUnripe.sol";

/**
 * @title UnripeFacet
 * @author ZrowGz, Publius , deadmanwalking
 * @notice @notice Manage the logic of the vesting process for the Barnraised Funds
 */

contract UnripeFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using SafeMath for uint256;

    event AddUnripeToken(
        address indexed unripeToken,
        address indexed underlyingToken,
        bytes32 merkleRoot
    );

    event ChangeUnderlying(address indexed token, int256 underlying);

    event SwitchUnderlyingToken(address indexed token, address indexed underlyingToken);

    event Chop(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 underlying
    );

    event ChangeUnderlying(address indexed token, int256 underlying);

    event Pick(
        address indexed account,
        address indexed token,
        uint256 amount
    );

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
        amount = LibTransfer.burnToken(IBean(unripeToken), amount, msg.sender, fromMode);
        // get ripe address and ripe amount
        (address underlyingToken, uint256 underlyingAmount) = LibChop.chop(unripeToken, amount);
        // send the corresponding amount of ripe token to the user address
        require(underlyingAmount > 0, "Chop: no underlying");
        IERC20(underlyingToken).sendToken(underlyingAmount, msg.sender, toMode);
        // emit the event
        emit Chop(msg.sender, unripeToken, amount, underlyingAmount);
        return underlyingAmount;
    }


    /**
     * @notice Enbles a user to collect their share of unripe tokens.
     * @param token The address of the unripe token to be collected.
     * @param amount The amount of the of the unripe token to be collected.
     * @param proof The merkle proof used to validate the claim in order to prevent miltiple picks from occuring.
     * @param mode Enum value to distinguish the type of account used to credit the unripe tokens after collecting.
     */
    function pick(
        address token,
        uint256 amount,
        bytes32[] memory proof,
        LibTransfer.To mode
    ) external payable nonReentrant {
        bytes32 root = s.u[token].merkleRoot;
        require(root != bytes32(0), "UnripeClaim: invalid token");
        require(
            !picked(msg.sender, token),
            "UnripeClaim: already picked"
        );

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(proof, root, leaf),
            "UnripeClaim: invalid proof"
        );
        s.unripeClaimed[token][msg.sender] = true;

        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);

        emit Pick(msg.sender, token, amount);
    }

   /**
     * @notice Getter function to check if an account has claimed (picked) their share of unripe tokens.
     * @param account The address of the account.
     * @param token The address of the unripe token.
     */
    function picked(address account, address token)
        public
        view
        returns (bool)
    {
        return s.unripeClaimed[token][account];
    }

    /**
     * @notice Getter function to get the corresponding underlying amount of ripe
     * tokens from its unripe counterpart.
     * @param unripeToken The address of the unripe token.
     * @param amount The amount of the unripe token.
     * @return redeem The amount of ripe tokens received from the unripe ones.
     */
    function getUnderlying(address unripeToken, uint256 amount)
        public
        view
        returns (uint256 redeem)
    {
        return LibUnripe.unripeToUnderlying(unripeToken, amount);
    }

    /**
     * @notice Getter function to get the corresponding penalty associated with an unripe asset.
     * @param unripeToken The address of the unripe token.
     * @return penalty The current penalty for converting unripe --> ripe
     */
    function getPenalty(address unripeToken)
        external
        view
        returns (uint256 penalty)
    {
        return getPenalizedUnderlying(unripeToken, LibUnripe.DECIMALS);
    }

    /**
     * @notice Getter function to get the corresponding amount 
     * of ripe tokens from a set amount of unripe tokens according to current state.
     * @param unripeToken The address of the unripe token.
     * @param amount The amount of the unripe token.
     * @return redeem The amount of the corresponding ripe tokens
     */
    function getPenalizedUnderlying(address unripeToken, uint256 amount)
        public
        view
        returns (uint256 redeem)
    {
        return LibChop._getPenalizedUnderlying(unripeToken, amount);
    }

    function _getPenalizedUnderlying(address unripeToken, uint256 amount, uint256 supply)
        public
        view
        returns (uint256 redeem)
    {
        return LibUnripe._getPenalizedUnderlying(unripeToken, amount, supply);
    /**
     * @notice Getter function to check if a token is unripe or not.
     * @param unripeToken The address of the unripe token.
     * @return unripe Whether the token is unripe or not.
     */
    function isUnripe(address unripeToken) external view returns (bool unripe) {
        unripe = LibChop.isUnripe(unripeToken);
    }

    function isUnripe(address unripeToken) external view returns (bool unripe) {
        return LibUnripe.isUnripe(unripeToken);
    }

    /**
     * @notice Getter function to get the balance of an underlying unripe asset from an account.
     * @param unripeToken The address of the unripe token.
     * @param account The address of the account to check.
     * @return underlying The amount of the underlying asset.
     */
    function balanceOfUnderlying(address unripeToken, address account)
        external
        view
        returns (uint256 underlying)
    {
        return
            getUnderlying(unripeToken, IERC20(unripeToken).balanceOf(account));
    }

    /**
     * @notice Getter function to get the balance of ripe tokens that can be credited to an account
     * according to the accounts' balance of an unripe token, if that account decided to convert.
     * @param unripeToken The address of the unripe token.
     * @param account The address of the account to check.
     * @return underlying The theoretical amount of the ripe asset in the account.
     */
    function balanceOfPenalizedUnderlying(address unripeToken, address account)
        external
        view
        returns (uint256 underlying)
    {
        return
            getPenalizedUnderlying(
                unripeToken,
                IERC20(unripeToken).balanceOf(account)
            );
    }

    /**
     * @notice Getter function to get the percent funded of an unripe token.
     * @param unripeToken The address of the unripe token.
     * @return percent The recap % of the token.
     */
    function getRecapFundedPercent(address unripeToken)
        public
        view
        returns (uint256 percent)
    {
        if (unripeToken == C.UNRIPE_BEAN) {
            return LibUnripe.percentBeansRecapped();
        } else if (unripeToken == C.UNRIPE_LP) {
            return LibUnripe.percentLPRecapped();
        }
        revert("not vesting");
    }
    
    /**
     * @notice Getter function to get the % penalty of converting from unripe to ripe.
     * @param unripeToken The address of the unripe token.
     * @return penalty The penalty %.
     */
    function getPercentPenalty(address unripeToken)
        external
        view
        returns (uint256 penalty)
    {
        return LibChop.getRecapPaidPercentAmount(getRecapFundedPercent(unripeToken));
    }
    
    /**
     * @notice Getter function to get the % of the recapitalization of an unripe asset.
     * @return penalty The penalty % stemming from the recap.
     */
    function getRecapPaidPercent() external view returns (uint256 penalty) {
        penalty = LibChop.getRecapPaidPercentAmount(LibUnripe.DECIMALS);
    }

    /**
     * @notice Getter function to get the corresponing amount a of ripe asset when converting
     * from its unripe counterpart.
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
     * @notice Getter function to get the total underlying amount of an unripe token.
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
     * @notice Adds an unripe token to the list of unripe tokens.
     * @param unripeToken The address of the unripe token to be added.
     * @param underlyingToken The address of the underlying token.
     * @param root The merkle root , later used to verify claims.
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
     * @notice Getter function to get the underlying token of an unripe token.
     * @param unripeToken The address of the unripe token.
     * @return underlyingToken The address of the underlying token.
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
     * @notice Adds underlying tokens to an Unripe Token.
     * @param unripeToken The Unripe Token to add underlying tokens to.
     * @param amount The amount of underlying tokens to add.
     * @dev Used to migrate the underlying token of an Unripe Token to a new token.
     * Only callable by the contract owner.
     */
    function addMigratedUnderlying(address unripeToken, uint256 amount) external payable nonReentrant {
        LibDiamond.enforceIsContractOwner();
        IERC20(s.u[unripeToken].underlyingToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        LibUnripe.incrementUnderlying(unripeToken, amount);
    }

    /**
     * @notice Switches the Underlying Token of an Unripe Token.
     * @param unripeToken The Unripe Token to switch the underlying token of.
     * @param newUnderlyingToken The new underlying token to switch to.
     * @dev `s.u[unripeToken].balanceOfUnderlying` must be 0.
     */
    function switchUnderlyingToken(address unripeToken, address newUnderlyingToken) external payable {
        LibDiamond.enforceIsContractOwner();
        require(s.u[unripeToken].balanceOfUnderlying == 0, "Unripe: Underlying balance > 0");
        LibUnripe.switchUnderlyingToken(unripeToken, newUnderlyingToken);
    }

    function getLockedBeans() public view returns (uint256) {
        return LibUnripe.getLockedBeans();
    }

    function getLockedBeansInUrBEAN() public view returns (uint256) {
        return LibUnripe.getTotalUnderlyingForfeited(C.UNRIPE_BEAN);
    }

    function getLockedBeansInUrBEANETH() public view returns (uint256) {
        return LibUnripe.getLockedBeansFromLP();
    }
}
