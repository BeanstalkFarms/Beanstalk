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
import {LibTransfer} from "../../libraries/Token/LibTransfer.sol";
import "../../interfaces/IBarnraise.sol";
import "../ReentrancyGuard.sol";

/// @author ZrowGz, Publius
/// @title VestingFacet
/// @notice Manage the logic of the vesting process for the Barnraised Funds

contract UnripeFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using SafeMath for uint256;

    uint256 constant PRECISION = 1e18;

    event AddUnripeToken(
        address indexed unripeToken,
        address indexed underlyingToken,
        bytes32 merkleRoot
    );

    event AddUnderlying(
        address indexed token,
        uint256 underlying
    );

    event Ripen(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 underlying
    );

    event ClaimUnripe(
        address indexed account,
        address indexed token,
        uint256 amount
    );

    function ripen(
        address unripeToken,
        uint256 amount,
        LibTransfer.To mode
    ) external payable nonReentrant returns (uint256 underlyingAmount) {
        underlyingAmount = getPenalizedUnderlying(unripeToken, amount);

        s.u[unripeToken].balanceOfUnderlying = s
            .u[unripeToken]
            .balanceOfUnderlying
            .sub(underlyingAmount);

        IBean(unripeToken).burnFrom(msg.sender, amount);

        address underlyingToken = s.u[unripeToken].underlyingToken;

        IERC20(underlyingToken).sendToken(
            underlyingAmount,
            msg.sender,
            mode
        );

        emit Ripen(msg.sender, unripeToken, amount, underlyingAmount);
    }
    
    function claimUnripe(
        address token,
        uint256 amount,
        bytes32[] memory proof
    ) external payable nonReentrant {
        bytes32 root = s.u[token].merkleRoot;
        require(root != bytes32(0), "UnripeClaim: invalid token");
        require(
            !s.unripeClaimed[token][msg.sender],
            "UnripeClaim: already claimed"
        );

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(proof, root, leaf),
            "UnripeClaim: invalid proof"
        );
        s.unripeClaimed[token][msg.sender] = true;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit ClaimUnripe(msg.sender, token, amount);
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

    function getPenalizedUnderlying(address unripeToken, uint256 amount)
        public
        view
        returns (uint256 redeem)
    {
        require(isUnripe(unripeToken), "not vesting");
        uint256 sharesBeingRedeemed = s.brPaidBeans.mul(amount).div(
            s.brOwedBeans,
            "set line"
        );
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

    function getRipenPenalty() external view returns (uint256 penalty) {
        penalty = s.brPaidBeans.mul(PRECISION).div(s.brOwedBeans, "set penalt");
    }

    function getUnderlyingPerUnripeToken(address unripeToken)
        external
        view
        returns (uint256 underlyingPerToken)
    {
        underlyingPerToken = s
            .u[unripeToken]
            .balanceOfUnderlying
            .mul(PRECISION)
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

    function addUnderlying(address unripeToken, uint256 amount)
        external
        payable
        nonReentrant
    {
        LibDiamond.enforceIsOwnerOrContract();
        address underlyingToken = s.u[unripeToken].underlyingToken;
        IERC20(underlyingToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        s.u[unripeToken].balanceOfUnderlying = s
            .u[unripeToken]
            .balanceOfUnderlying
            .add(amount);
        emit AddUnderlying(unripeToken, amount);
    }
}
