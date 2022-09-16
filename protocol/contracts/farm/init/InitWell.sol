/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";

interface IBS {

    enum WellType {
        CONSTANT_PRODUCT
    }

    function buildWell(
        IERC20[] calldata tokens,
        WellType wellType,
        bytes calldata typeData,
        string[] calldata symbols
    ) external payable returns (address wellId);

    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalk,
        uint32 seeds,
        bool useData,
        bytes16 data
    ) external payable;

    function getLPValue(
        address wellId,
        uint256 amount,
        uint256 tokenI
    ) external view returns (uint256 value);
}

contract InitWell {

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; 

    function init() external {

        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = IERC20(C.beanAddress());
        tokens[1] = IERC20(WETH);

        string[] memory symbols = new string[](2);
        symbols[0] = "BEAN";
        symbols[1] = "WETH";

        bytes memory typeData;
        address wellToken = IBS(address(this)).buildWell(tokens, IBS.WellType.CONSTANT_PRODUCT, typeData, symbols);
        IBS(address(this)).whitelistToken(wellToken, IBS.getLPValue.selector, 10000, 4, true, bytes16(0));
    }
}
