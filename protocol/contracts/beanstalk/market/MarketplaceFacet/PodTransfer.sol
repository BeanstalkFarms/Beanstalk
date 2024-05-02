/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "contracts/beanstalk/AppStorage.sol";
import "contracts/interfaces/IBean.sol";
import "contracts/beanstalk/ReentrancyGuard.sol";
import "contracts/C.sol";

/**
 * @author Publius
 * @title Pod Transfer
 **/

contract PodTransfer is ReentrancyGuard {
    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);
    event PodApproval(address indexed owner, address indexed spender, uint256 pods);

    /**
     * Getters
     **/

    function allowancePods(address owner, address spender) public view returns (uint256) {
        return s.a[owner].field.podAllowances[spender];
    }

    /**
     * Internal
     **/

    function _transferPlot(
        address from,
        address to,
        uint256 index,
        uint256 start,
        uint256 amount
    ) internal {
        require(from != to, "Field: Cannot transfer Pods to oneself.");
        insertPlot(to, index + start, amount);
        removePlot(from, index, start, amount + start);
        emit PlotTransfer(from, to, index + start, amount);
    }

    function insertPlot(address account, uint256 id, uint256 amount) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(address account, uint256 id, uint256 start, uint256 end) internal {
        uint256 amount = s.a[account].field.plots[id];
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount) s.a[account].field.plots[id + end] = amount - end;
    }

    function decrementAllowancePods(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowancePods(owner, spender);
        require(
            currentAllowance >= amount,
            "Field: Insufficient approval."
        );
        setAllowancePods(
            owner,
            spender,
            currentAllowance - amount
        );
    }

    function setAllowancePods(address owner, address spender, uint256 amount) internal {
        s.a[owner].field.podAllowances[spender] = amount;
    }
}
