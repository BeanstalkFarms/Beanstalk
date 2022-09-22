// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

enum ConvertKind {
    BEANS_TO_CURVE_LP,
    CURVE_LP_TO_BEANS,
    UNRIPE_BEANS_TO_UNRIPE_LP,
    UNRIPE_LP_TO_UNRIPE_BEANS,
    LAMBDA_LAMBDA
}

interface IBeanstalk {
    function season() external view returns (uint32);
    function getDeposit(
        address account,
        address token,
        uint32 _season
    ) external view returns (uint256, uint256);

    function balanceOfSeeds(address account) external view returns (uint256);
    function balanceOfStalk(address account) external view returns (uint256);
    
    function transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable returns (uint256[] memory bdvs);
    function plant() external payable returns (uint256);
}
