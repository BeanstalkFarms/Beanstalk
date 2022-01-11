/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/BalanceFacet.sol";

/**
 * @author Publius
 * @title Mock Balance Facet
**/
contract MockBalanceFacet is BalanceFacet {
    function allocateE(
        IERC20 token,
        address account,
        uint256 amount,
        bool fromInternalBalance
    ) external {
        LibUserBalance._allocate(token, account, amount, fromInternalBalance);
    }
}
