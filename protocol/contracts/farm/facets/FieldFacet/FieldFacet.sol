/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanDibbler.sol";
import "../../../libraries/LibClaim.sol";

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

    // Claim and Sow Beans

    function claimAndSowBeans(uint256 amount, LibClaim.Claim calldata claim)
        external
        nonReentrant
        returns (uint256 pods)
    {
        return _claimAndSowBeansWithMin(amount, amount, claim);
    }

    function claimAndSowBeansWithMin(uint256 amount, uint256 minAmount, LibClaim.Claim calldata claim)
        external
        nonReentrant
        returns (uint256 pods)
    {
        return _claimAndSowBeansWithMin(amount, minAmount, claim);
    }

    function _claimAndSowBeansWithMin(uint256 amount, uint256 minAmount, LibClaim.Claim calldata claim)
        private
        returns (uint256 pods)
    {
        amount = getSowAmount(amount, minAmount);
        allocateBeans(claim, amount);
        pods = _sowBeans(amount, false);
        LibMarket.claimRefund(claim);
    }

    // Claim, Buy and Sow Beans

    function claimBuyAndSowBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
        nonReentrant
        returns (uint256 pods)
    {
        return _claimBuyAndSowBeansWithMin(amount, buyAmount, amount.add(buyAmount), claim);
    }

    function claimBuyAndSowBeansWithMin(
        uint256 amount,
        uint256 buyAmount,
        uint256 minAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
        nonReentrant
        returns (uint256 pods)
    {
        return _claimBuyAndSowBeansWithMin(amount, buyAmount, minAmount, claim);
    }

    function _claimBuyAndSowBeansWithMin(
        uint256 amount,
        uint256 buyAmount,
        uint256 minAmount,
        LibClaim.Claim calldata claim
    )
        private
        returns (uint256 pods)
    {
        uint256 ethAmount;
        (amount, buyAmount, ethAmount) = getBuyAndSowAmount(amount, buyAmount, minAmount, msg.value);
        allocateBeans(claim, amount);
        uint256 boughtAmount = LibMarket.buyAndSow(buyAmount, ethAmount);
        pods = _sowBeans(boughtAmount.add(amount), false);
        LibMarket.refund();
    }

    // Sow Beans

    function sowBeans(uint256 amount) external returns (uint256) {
        return sowBeansWithMin(amount, amount);
    }

    function sowBeansWithMin(uint256 amount, uint256 minAmount) public returns (uint256) {
        amount = getSowAmount(amount, minAmount);
        return _sowBeans(amount, true);
    }

    // Buy and Sow Beans

    function buyAndSowBeans(
        uint256 amount, 
        uint256 buyAmount
    ) external payable nonReentrant returns (uint256 pods) {
        return _buyAndSowBeansWithMin(amount, buyAmount, amount.add(buyAmount));
    }

    function buyAndSowBeansWithMin(
        uint256 amount, 
        uint256 buyAmount, 
        uint256 minAmount
    ) external payable nonReentrant returns (uint256 pods) {
        return _buyAndSowBeansWithMin(amount, buyAmount, minAmount);
    }

    function _buyAndSowBeansWithMin(
        uint256 amount, 
        uint256 buyAmount, 
        uint256 minAmount
    ) private returns (uint256 pods) {
        uint256 ethAmount;
        (amount, buyAmount, ethAmount) = getBuyAndSowAmount(amount, buyAmount, minAmount, msg.value);
        uint256 boughtAmount = LibMarket.buyAndSow(buyAmount, ethAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        pods = _sowBeans(boughtAmount.add(amount), false);
        LibMarket.refund();
    }

    // Helpers

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocateBeans(transferBeans);
    }

    function getSowAmount(uint256 amount, uint256 minAmount) private view returns (uint256 maxSowAmount) {
        maxSowAmount = s.f.soil;
        require(
            maxSowAmount >= minAmount && 
            amount >= minAmount && 
            minAmount > 0, 
            "Field: Sowing below min or 0 pods."
        );
        if (amount < maxSowAmount) return amount;
    }

    function getBuyAndSowAmount(uint256 amount, uint256 buyAmount, uint256 minAmount, uint256 ethAmount) 
        private
        view
        returns (uint256 maxSowAmount, uint256 sowBuyAmount, uint256 sowEthAmount) 
    {
        maxSowAmount = s.f.soil;
        require(
            maxSowAmount >= minAmount && 
            amount.add(buyAmount) >= minAmount && 
            minAmount > 0, 
            "Field: Sowing below min or 0 pods."
        );
        if (amount.add(buyAmount) <= maxSowAmount) return (amount, buyAmount, ethAmount);
        if (amount < maxSowAmount) {
            sowBuyAmount = maxSowAmount.sub(amount);
            sowEthAmount = (ethAmount.sub(1)).mul(sowBuyAmount).div(buyAmount).add(1);
            return (amount, sowBuyAmount, sowEthAmount);
        }
    }
}
