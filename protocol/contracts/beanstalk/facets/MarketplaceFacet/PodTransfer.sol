/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../ReentrancyGuard.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Pod Transfer
 **/
 
contract PodTransfer is ReentrancyGuard {
    
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event PlotTransfer(
        address indexed from,
        address indexed to,
        uint256 indexed id,
        uint256 pods
    );
    event PodApproval(
        address indexed owner,
        address indexed spender,
        uint256 pods
    );

    /**
     * Getters
     **/

    function allowancePods(address owner, address spender)
        public
        view
        returns (uint256)
    {
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
        insertPlot(to, index.add(start), amount);
        removePlot(from, index, start, amount.add(start));
        emit PlotTransfer(from, to, index.add(start), amount);
    }

    function insertPlot(
        address account,
        uint256 id,
        uint256 amount
    ) internal {
        s.a[account].field.plots[id] = amount;
    }

    function removePlot(
        address account,
        uint256 id,
        uint256 start,
        uint256 end
    ) internal {
        uint256 amount = s.a[account].field.plots[id];
        if (start == 0) delete s.a[account].field.plots[id];
        else s.a[account].field.plots[id] = start;
        if (end != amount)
            s.a[account].field.plots[id.add(end)] = amount.sub(end);
    }

    function decrementAllowancePods(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        uint256 currentAllowance = allowancePods(owner, spender);
        setAllowancePods(
            owner,
            spender,
            currentAllowance.sub(amount, "Field: Insufficient approval.")
            );
    }

    function setAllowancePods(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        s.a[owner].field.podAllowances[spender] = amount;
    }
}
