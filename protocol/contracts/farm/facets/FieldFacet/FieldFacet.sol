/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./PodTransfer.sol";
import "../../../libraries/LibClaim.sol";

/**
 * @author Publius
 * @title Field sows Beans and transfers Pods.
**/
contract FieldFacet is PodTransfer {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);
    event PodApproval(address indexed owner, address indexed spender, uint256 pods);

    /**
     * Sow
    **/

    function claimAndSowBeans(uint256 amount, LibClaim.Claim calldata claim)
        external
        returns (uint256)
    {
        allocateBeans(claim, amount);
        return _sowBeans(amount);
    }

    function claimBuyAndSowBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
        returns (uint256)
    {
        allocateBeans(claim, amount);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        return _sowBeans(amount.add(boughtAmount));
    }

    function sowBeans(uint256 amount) external returns (uint256) {
        bean().transferFrom(msg.sender, address(this), amount);
        return _sowBeans(amount);
    }

    function buyAndSowBeans(uint256 amount, uint256 buyAmount) public payable returns (uint256) {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        return _sowBeans(amount.add(boughtAmount));
    }

    /**
     * Transfer
    **/

    function transferPlot(address sender, address recipient, uint256 id, uint256 start, uint256 end)
        external
    {
        require(sender != address(0), "Field: Transfer from 0 address.");
        require(recipient != address(0), "Field: Transfer to 0 address.");
        require(end > start, "Field: Pod range invalid.");
        uint256 amount = plot(sender, id);
        require(amount > 0, "Field: Plot not owned by user.");
        require(amount >= end, "Field: Pod range too long.");
        amount = end.sub(start);
        insertPlot(recipient,id.add(start),amount);
        removePlot(sender,id,start,end);
        if (msg.sender != sender && allowancePods(sender, msg.sender) != uint256(-1)) {
                decrementAllowancePods(sender, msg.sender, amount);
        }
        emit PlotTransfer(sender, recipient, id.add(start), amount);
    }

    function approvePods(address spender, uint256 amount) external {
        require(spender != address(0), "Field: Pod Approve to 0 address.");
        setAllowancePods(msg.sender, spender, amount);
        emit PodApproval(msg.sender, spender, amount);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocatedBeans(transferBeans);
    }

}
