/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IBean} from "../../interfaces/IBean.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibUnripe} from "../../libraries/LibUnripe.sol";
import {LibTransfer} from "../../libraries/Token/LibTransfer.sol";
import "../../C.sol";
import "../ReentrancyGuard.sol";

/// @author ZrowGz, Publius
/// @title VestingFacet
/// @notice Manage the logic of the vesting process for the Barnraised Funds

contract UnripeFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using SafeMath for uint256;

    uint256 constant DECIMALS = 1e6;

    event AddUnripeToken(
        address indexed unripeToken,
        address indexed underlyingToken,
        bytes32 merkleRoot
    );

    event ChangeUnderlying(address indexed token, int256 underlying);

    event Chop(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 underlying
    );

    event Pick(
        address indexed account,
        address indexed token,
        uint256 amount
    );

    function chop(
        address unripeToken,
        uint256 amount,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256 underlyingAmount) {
        underlyingAmount = getPenalizedUnderlying(unripeToken, amount);

        LibUnripe.decrementUnderlying(unripeToken, underlyingAmount);

        LibTransfer.burnToken(IBean(unripeToken), amount, msg.sender, fromMode);

        address underlyingToken = s.u[unripeToken].underlyingToken;

        IERC20(underlyingToken).sendToken(underlyingAmount, msg.sender, toMode);

        emit Chop(msg.sender, unripeToken, amount, underlyingAmount);
    }

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

    function picked(address account, address token)
        public
        view
        returns (bool)
    {
        return s.unripeClaimed[token][account];
    }

    function getUnderlying(address unripeToken, uint256 amount)
        public
        view
        returns (uint256 redeem)
    {
        redeem = s.u[unripeToken].balanceOfUnderlying.mul(amount).div(
            IERC20(unripeToken).totalSupply()
        );
    }

    function getPenalty(address unripeToken)
        external
        view
        returns (uint256 penalty)
    {
        return getPenalizedUnderlying(unripeToken, DECIMALS);
    }

    function getPenalizedUnderlying(address unripeToken, uint256 amount)
        public
        view
        returns (uint256 redeem)
    {
        require(isUnripe(unripeToken), "not vesting");
        uint256 sharesBeingRedeemed = getRecapPaidPercentAmount(amount);
        redeem = getUnderlying(unripeToken, sharesBeingRedeemed);
    }

    function isUnripe(address unripeToken) public view returns (bool unripe) {
        unripe = s.u[unripeToken].underlyingToken != address(0);
    }

    function balanceOfUnderlying(address unripeToken, address account)
        external
        view
        returns (uint256 underlying)
    {
        return
            getUnderlying(unripeToken, IERC20(unripeToken).balanceOf(account));
    }

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

    function getRecapFundedPercent(address unripeToken)
        public
        view
        returns (uint256 percent)
    {
        if (unripeToken == C.unripeBeanAddress()) {
            return LibUnripe.percentBeansRecapped();
        } else if (unripeToken == C.unripeLPAddress()) {
            return LibUnripe.percentLPRecapped();
        }
        revert("not vesting");
    }

    function getPercentPenalty(address unripeToken)
        external
        view
        returns (uint256 penalty)
    {
        return getRecapPaidPercentAmount(getRecapFundedPercent(unripeToken));
    }

    function getRecapPaidPercent() external view returns (uint256 penalty) {
        penalty = getRecapPaidPercentAmount(DECIMALS);
    }

    function getRecapPaidPercentAmount(uint256 amount)
        private
        view
        returns (uint256 penalty)
    {
        return s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    }

    function getUnderlyingPerUnripeToken(address unripeToken)
        external
        view
        returns (uint256 underlyingPerToken)
    {
        underlyingPerToken = s
            .u[unripeToken]
            .balanceOfUnderlying
            .mul(DECIMALS)
            .div(IERC20(unripeToken).totalSupply());
    }

    function getTotalUnderlying(address unripeToken)
        external
        view
        returns (uint256 underlying)
    {
        return s.u[unripeToken].balanceOfUnderlying;
    }

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
}
