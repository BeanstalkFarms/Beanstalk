// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import "../farm/facets/DepotFacet.sol";
import "../interfaces/IBeanstalkTransfer.sol";
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
    **/
    function transferToken(
        IERC20 token,
        address recipient,
        uint256 amount,
        From fromMode,
        To toMode
    ) external payable {
        beanstalk.transferTokenFrom(token, msg.sender, recipient, amount, fromMode, toMode);
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
     * @notice Execute a permit for an ERC-20 tokens.
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
