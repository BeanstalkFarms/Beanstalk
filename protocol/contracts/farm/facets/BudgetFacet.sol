/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./FieldFacet/Dibbler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Publius
 * @title Budget Facet
**/
contract BudgetFacet is Dibbler {

    using SafeMath for uint256;

    function budgetSow(uint256 amount) public returns (uint256) {
        require(isBudget(msg.sender), "Budget: sender must be budget.");
        bean().burnFrom(msg.sender, amount);

        decreaseSoil(amount);

        return _sowNoSoil(amount, msg.sender);
    }

    function isBudget(address account) public view returns (bool) {
        return s.isBudget[account];
    }

    function decreaseSoil(uint256 amount) private {
        uint256 soil = s.f.soil;
        if (soil > amount) s.f.soil = soil.sub(amount);
        else if (soil > 0) s.f.soil = 0;
    }
}