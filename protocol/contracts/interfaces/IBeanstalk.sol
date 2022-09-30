// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable-8/token/ERC20/IERC20Upgradeable.sol";

enum ConvertKind {
    BEANS_TO_CURVE_LP,
    CURVE_LP_TO_BEANS,
    UNRIPE_BEANS_TO_UNRIPE_LP,
    UNRIPE_LP_TO_UNRIPE_BEANS,
    LAMBDA_LAMBDA
}

enum From {
    EXTERNAL,
    INTERNAL,
    EXTERNAL_INTERNAL,
    INTERNAL_TOLERANT
}
enum To {
    EXTERNAL,
    INTERNAL
}

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

    function transferTokenFrom(
        IERC20Upgradeable token,
        address from,
        address to,
        uint256 amount,
        From fromMode,
        To toMode
    ) external payable;

    function transferToken(
        IERC20Upgradeable token,
        address recipient,
        uint256 amount,
        From fromMode,
        To toMode
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
}
