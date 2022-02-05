/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/BudgetFacet.sol";

/**
 * @author Publius
 * @title Mock Budget Facet
**/
contract MockBudgetFacet is BudgetFacet {

    function setIsBudgetE(address account) public {
        s.isBudget[account] = true;
    }

}
