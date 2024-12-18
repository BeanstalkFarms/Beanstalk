/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../../interfaces/IERC4494.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";

import {LibTractor} from "../../libraries/LibTractor.sol";

/**
 * @author Publius
 * @title TokenSupportFacet
 * @notice Permit ERC-20 and ERC-721 tokens and transfer ERC-721 and ERC-1155 tokens.
 * @dev To transfer ERC-20 tokens, use {TokenFacet.transferToken}.
 **/

contract TokenSupportFacet is Invariable, ReentrancyGuard {
    /**
     *
     * ERC-20
     *
     */

    /// @notice permitERC20 is wrapper function for permit of ERC20Permit token
    /// @dev See {IERC20Permit-permit}.
    function permitERC20(
        IERC20Permit token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        token.permit(owner, spender, value, deadline, v, r, s);
    }

    /**
     *
     * ERC-721
     *
     **/

    /**
     * @notice Execute an ERC-721 token transfer
     * @dev Wraps {IERC721-safeBatchTransferFrom}.
     **/
    function transferERC721(
        IERC721 token,
        address to,
        uint256 id
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        token.safeTransferFrom(LibTractor._user(), to, id);
    }

    /**
     * @notice Execute a permit for an ERC-721 token.
     * @dev See {IERC4494-permit}.
     **/
    function permitERC721(
        IERC4494 token,
        address spender,
        uint256 tokenId,
        uint256 deadline,
        bytes memory sig
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        token.permit(spender, tokenId, deadline, sig);
    }

    /**
     *
     * ERC-1155
     *
     **/

    /**
     * @notice Execute an ERC-1155 token transfer of a single Id.
     * @dev Wraps {IERC1155-safeTransferFrom}.
     **/
    function transferERC1155(
        IERC1155 token,
        address to,
        uint256 id,
        uint256 value
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        token.safeTransferFrom(LibTractor._user(), to, id, value, new bytes(0));
    }

    /**
     * @notice Execute an ERC-1155 token transfer of multiple Ids.
     * @dev Wraps {IERC1155-safeBatchTransferFrom}.
     **/
    function batchTransferERC1155(
        IERC1155 token,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant {
        token.safeBatchTransferFrom(LibTractor._user(), to, ids, values, new bytes(0));
    }
}
