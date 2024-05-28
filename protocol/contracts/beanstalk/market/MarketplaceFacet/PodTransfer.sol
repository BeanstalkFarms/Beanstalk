/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibDibbler} from "contracts/libraries/LibDibbler.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius, Brean
 * @title Pod Transfer
 **/

contract PodTransfer is ReentrancyGuard {
    event PlotTransfer(
        address indexed from,
        address indexed to,
        uint256 indexed index,
        uint256 amount
    );

    event PodApproval(
        address indexed owner,
        address indexed spender,
        uint256 fieldId,
        uint256 amount
    );

    /**
     * Getters
     **/

    function allowancePods(
        address owner,
        address spender,
        uint256 fieldId
    ) public view returns (uint256) {
        return s.accts[owner].fields[fieldId].podAllowances[spender];
    }

    /**
     * Internal
     **/

    function _transferPlot(
        address from,
        address to,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 amount
    ) internal {
        require(from != to, "Field: Cannot transfer Pods to oneself.");
        insertPlot(to, fieldId, index + start, amount);
        removePlot(from, fieldId, index, start, amount + start);
        emit PlotTransfer(from, to, index + start, amount);
    }

    function insertPlot(address account, uint256 fieldId, uint256 index, uint256 amount) internal {
        s.accts[account].fields[fieldId].plots[index] = amount;
        s.accts[account].fields[fieldId].plotIndexes.push(index);
    }

    function removePlot(
        address account,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 end
    ) internal {
        uint256 amountAfterEnd = s.accts[account].fields[fieldId].plots[index] - end;

        if (start > 0) {
            s.accts[account].fields[fieldId].plots[index] = start;
        } else {
            delete s.accts[account].fields[fieldId].plots[index];
            LibDibbler.removePlotIndexFromAccount(account, fieldId, index);
        }

        if (amountAfterEnd > 0) {
            uint256 newIndex = index + end;
            s.accts[account].fields[fieldId].plots[newIndex] = amountAfterEnd;
            s.accts[account].fields[fieldId].plotIndexes.push(newIndex);
        }
    }

    function decrementAllowancePods(
        address owner,
        address spender,
        uint256 fieldId,
        uint256 amount
    ) internal {
        uint256 currentAllowance = allowancePods(owner, spender, fieldId);
        if (currentAllowance < amount) {
            revert("Field: Insufficient approval.");
        }
        setAllowancePods(owner, spender, fieldId, currentAllowance - amount);
    }

    function setAllowancePods(
        address owner,
        address spender,
        uint256 fieldId,
        uint256 amount
    ) internal {
        s.accts[owner].fields[fieldId].podAllowances[spender] = amount;
    }
}
