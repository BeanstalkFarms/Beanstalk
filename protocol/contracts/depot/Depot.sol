// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../farm/facets/DepotFacet.sol";
import "../interfaces/IBeanstalkTransfer.sol";
import "../interfaces/IERC4494.sol";
import "../libraries/LibFunction.sol";

/**
 * @title Depot
 * @author Publius
 * @notice Depot wraps Pipeline's Pipe functions to facilitate the loading of non-Ether assets in Pipeline
 * in the same transaction that loads Ether, Pipes calls to other protocols and unloads Pipeline.
 * https://evmpipeline.org
**/

contract Depot is DepotFacet {

    IBeanstalkTransfer private constant beanstalk =
        IBeanstalkTransfer(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);

    /**
     * 
     * Farm
     * 
    **/

    /**
     * @notice Execute multiple function calls in Depot.
     * @param data list of encoded function calls to be executed
     * @return results list of return data from each function call
     * @dev Implementation from https://github.com/Uniswap/v3-periphery/blob/main/contracts/base/Multicall.sol.
    **/
    function farm(bytes[] calldata data)
        external
        payable
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            LibFunction.checkReturn(success, result);
            results[i] = result;
        }
    }

    /**
     *
     * Transfer
     *
    **/

    /**
     * @notice Execute a Beanstalk ERC-20 token transfer.
     * @dev See {TokenFacet-transferToken}.
     * @dev Only supports INTERNAL and EXTERNAL From modes.
    **/
    function transferToken(
        IERC20 token,
        address recipient,
        uint256 amount,
        From fromMode,
        To toMode
    ) external payable {
        if (fromMode == From.EXTERNAL) {
            token.transferFrom(msg.sender, recipient, amount);
        } else if (fromMode == From.INTERNAL) {
            beanstalk.transferInternalTokenFrom(token, msg.sender, recipient, amount, toMode);
        } else {
            revert("Mode not supported");
        }
    }

    /**
     * @notice Execute an ERC-721 token transfer
     * @dev Wraps {IERC721-safeBatchTransferFrom}.
    **/
    function transferERC721(
        IERC721 token,
        address to,
        uint256 id
    ) external payable {
        token.safeTransferFrom(msg.sender, to, id);
    }

    /**
     * @notice Execute an ERC-1155 token transfer of a single Id.
     * @dev Wraps {IERC1155-safeTransferFrom}.
    **/
    function transferERC1155(
        IERC1155 token,
        address to,
        uint256 id,
        uint256 value
    ) external payable {
        token.safeTransferFrom(msg.sender, to, id, value, new bytes(0));
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
    ) external payable {
        token.safeBatchTransferFrom(msg.sender, to, ids, values, new bytes(0));
    }

    /**
     * @notice Execute a single Beanstalk Deposit transfer.
     * @dev See {SiloFacet-transferDeposit}.
    **/
    function transferDeposit(
        address sender,
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) external payable returns (uint256 bdv) {
        require(sender == msg.sender, "invalid sender");
        bdv = beanstalk.transferDeposit(msg.sender, recipient, token, season, amount);
    }

    /**
     * @notice Execute multiple Beanstalk Deposit transfers of a single Whitelisted Tokens.
     * @dev See {SiloFacet-transferDeposits}.
    **/
    function transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable returns (uint256[] memory bdvs) {
        require(sender == msg.sender, "invalid sender");
        bdvs = beanstalk.transferDeposits(msg.sender, recipient, token, seasons, amounts);
    }

    /**
     *
     * Permits
     *
    **/

    /**
     * @notice Execute a permit for an ERC-20 token.
     * @dev See {IERC20Permit-permit}.
    **/
    function permitERC20(
        IERC20Permit token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable {
        token.permit(owner, spender, value, deadline, v, r, s);
    }

    /**
     * @notice Execute a permit for an ERC-20 Token stored in a Beanstalk Farm balance.
     * @dev See {TokenFacet-permitToken}.
    **/
    function permitToken(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable {
        beanstalk.permitToken(owner, spender, token, value, deadline, v, r, s);
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
    ) external payable {
        token.permit(spender, tokenId, deadline, sig);
    }

    /**
     * @notice Execute a permit for Beanstalk Deposits of a single Whitelisted Token.
     * @dev See {SiloFacet-permitDeposit}.
    **/
    function permitDeposit(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable {
        beanstalk.permitDeposit(owner, spender, token, value, deadline, v, r, s);
    }

    /**
     * @notice Execute a permit for a Beanstalk Deposits of a multiple Whitelisted Tokens.
     * @dev See {SiloFacet-permitDeposits}.
    **/
    function permitDeposits(
        address owner,
        address spender,
        address[] calldata tokens,
        uint256[] calldata values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable {
        beanstalk.permitDeposits(owner, spender, tokens, values, deadline, v, r, s);
    }
}
