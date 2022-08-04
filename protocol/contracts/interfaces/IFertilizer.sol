// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;

interface IFertilizer {
    struct Balance {
        uint128 amount;
        uint128 lastBpf;
    }
    function beanstalkUpdate(
        address account,
        uint256[] memory ids,
        uint128 bpf
    ) external returns (uint256);
    function beanstalkMint(address account, uint256 id, uint128 amount, uint128 bpf) external;
    function balanceOfFertilized(address account, uint256[] memory ids) external view returns (uint256);
    function balanceOfUnfertilized(address account, uint256[] memory ids) external view returns (uint256);
    function lastBalanceOf(address account, uint256 id) external view returns (Balance memory);
    function lastBalanceOfBatch(address[] memory account, uint256[] memory id) external view returns (Balance[] memory);
    function setURI(string calldata newuri) external;
}