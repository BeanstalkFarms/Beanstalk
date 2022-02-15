/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanDibbler.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibUserBalance.sol";

/**
 * @author Publius
 * @title Field sows Beans.
**/
contract FieldFacet is BeanDibbler {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    /**
     * Sow
    **/

    function claimAndSowBeans(uint256 amount, bool partialUpdateSilo, LibClaim.Claim calldata claim)
        external
        returns (uint256)
    {
        allocateBeans(claim, amount, partialUpdateSilo);
        return _sowBeans(amount);
    }

    function claimBuyAndSowBeans(
        uint256 amount,
        uint256 buyAmount,
        bool partialUpdateSilo,
        LibClaim.Claim calldata claim
    )
        external
        payable
        returns (uint256)
    {
        allocateBeans(claim, amount, partialUpdateSilo);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        return _sowBeans(amount.add(boughtAmount));
    }

    function sowBeans(uint256 amount, bool fromInternalBalance) external returns (uint256) {
        if (!fromInternalBalance) bean().transferFrom(msg.sender, address(this), amount);
        else LibUserBalance._decreaseInternalBalance(msg.sender, bean(), amount, false);
        return _sowBeans(amount);
    }

    function buyAndSowBeans(uint256 amount, uint256 buyAmount) public payable returns (uint256) {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        return _sowBeans(amount.add(boughtAmount));
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, bool partialUpdateSilo) private {
        LibClaim.claim(partialUpdateSilo, c);
        LibMarket.allocateBeans(transferBeans);
    }

}
