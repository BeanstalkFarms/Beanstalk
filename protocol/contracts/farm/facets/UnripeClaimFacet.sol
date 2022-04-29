/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "../ReentrancyGuard.sol";

/*
 * @author Publius
 * @title UnripeClaimFacet handles distributing Unripe Bean and Unripe LP tokens.
 */
contract UnripeClaimFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    event UnripeTokenClaimed(
        address indexed token,
        address indexed user,
        uint256 amount
    );

    function setMerkleRoot(address token, bytes32 root) external {
        require(token != address(0), "UnripeClaim: invalid token");
        LibDiamond.enforceIsContractOwner();
        s.merkleRoots[token] = root;
    }

    function claimUnripeTokens(
        address token,
        uint256 amount,
        bytes32[] memory proof
    ) public nonReentrant {
        bytes32 root = s.merkleRoots[token];
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

        emit UnripeTokenClaimed(token, msg.sender, amount);
    }
}
