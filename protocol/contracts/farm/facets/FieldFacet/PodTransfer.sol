/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Dibbler.sol";

/**
 * @author Publius
 * @title Pod Transfer
**/
contract PodTransfer is Dibbler {

    using SafeMath for uint256;
    using SafeMath for uint32;

    /**
     * Getters
    **/

    function allowancePods(address owner, address spender) public view returns (uint256) {
        return s.a[owner].field.podAllowances[spender];
    }

    /**
     * Internal
    **/

    function insertPlot(address account, uint256 id, uint256 amount) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(address account, uint256 id, uint256 start, uint256 end) internal {
        uint256 amount = plot(account, id);
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount) s.a[account].field.plots[id.add(end)] = amount.sub(end);
    }

    function decrementAllowancePods(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowancePods(owner, spender);
        setAllowancePods(
            owner,
            spender,
            currentAllowance.sub(amount, "Field: Insufficient approval.")
        );
    }

    function setAllowancePods(address owner, address spender, uint256 amount) internal {
        s.a[owner].field.podAllowances[spender] = amount;
    }

}
