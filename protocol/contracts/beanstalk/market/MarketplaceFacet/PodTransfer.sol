/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius
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
        uint256 fieldIndex,
        uint256 amount
    );

    /**
     * Getters
     **/

    function allowancePods(
        address owner,
        address spender,
        uint256 fieldIndex
    ) public view returns (uint256) {
        return s.accounts[owner].fields[fieldIndex].podAllowances[spender];
    }

    /**
     * Internal
     **/

    function _transferPlot(
        address from,
        address to,
        uint256 fieldIndex,
        uint256 index,
        uint256 start,
        uint256 amount
    ) internal {
        require(from != to, "Field: Cannot transfer Pods to oneself.");
        insertPlot(to, fieldIndex, index + start, amount);
        removePlot(from, fieldIndex, index, start, amount + start);
        emit PlotTransfer(from, to, index + start, amount);
    }

    function insertPlot(
        address account,
        uint256 fieldIndex,
        uint256 index,
        uint256 amount
    ) internal {
        s.accounts[account].fields[fieldIndex].plots[index] = amount;
    }

    function removePlot(
        address account,
        uint256 fieldIndex,
        uint256 index,
        uint256 start,
        uint256 end
    ) internal {
        uint256 amountAfterEnd = s.accounts[account].fields[fieldIndex].plots[index] - end;

        if (start > 0) {
            s.accounts[account].fields[fieldIndex].plots[index] = start;
        } else {
            delete s.accounts[account].fields[fieldIndex].plots[index];
        }

        if (amountAfterEnd > 0) {
            s.accounts[account].fields[fieldIndex].plots[index + end] = amountAfterEnd;
        }
    }

    function decrementAllowancePods(
        address owner,
        address spender,
        uint256 fieldIndex,
        uint256 amount
    ) internal {
        uint256 currentAllowance = allowancePods(owner, spender, fieldIndex);
        if (currentAllowance < amount) {
            revert("Field: Insufficient approval.");
        }
        setAllowancePods(owner, spender, fieldIndex, currentAllowance - amount);
    }

    function setAllowancePods(
        address owner,
        address spender,
        uint256 fieldIndex,
        uint256 amount
    ) internal {
        s.accounts[owner].fields[fieldIndex].podAllowances[spender] = amount;
    }
}
