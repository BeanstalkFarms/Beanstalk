// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AdvancedFarmCall} from "../libraries/LibFarm.sol";
import {LibTransfer} from "../libraries/Token/LibTransfer.sol";

interface IBeanstalk {
    function balanceOfSeeds(address account) external view returns (uint256);

    function balanceOfStalk(address account) external view returns (uint256);

    function transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable returns (uint256[] memory bdvs);

    function permitDeposit(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function permitDeposits(
        address owner,
        address spender,
        address[] calldata tokens,
        uint256[] calldata values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function plant() external payable returns (uint256);

    function update(address account) external payable;

    function transferInternalTokenFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount,
        LibTransfer.To toMode
    ) external payable;

    function transferToken(
        IERC20 token,
        address recipient,
        uint256 amount,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable;

    function permitToken(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function convert(
        bytes calldata convertData,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        external
        payable
        returns (
            uint32 toSeason,
            uint256 fromAmount,
            uint256 toAmount,
            uint256 fromBdv,
            uint256 toBdv
        );

    function deposit(
        address token,
        uint256 _amount,
        LibTransfer.From mode
    ) external payable returns (uint256 amount, uint256 _bdv, int96 stem);

    function getDeposit(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256, uint256);

    function enrootDeposits(
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) external payable;

    function advancedFarm(
        AdvancedFarmCall[] calldata data
    ) external payable returns (bytes[] memory results);
}
