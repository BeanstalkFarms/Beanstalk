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

    function claimAndSowBeans(uint256 amount, LibClaim.Claim calldata claim)
        external
        nonReentrant
        returns (uint256 pods)
    {
        amount = getSowAmount(amount);
        allocateBeans(claim, amount);
        pods = _sowBeans(amount, false);
        LibMarket.claimRefund(claim);
    }

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
        uint256 ethAmount;
        (amount, buyAmount, ethAmount) = getBuyAndSowAmount(amount, buyAmount, msg.value);
        allocateBeans(claim, amount);
        uint256 boughtAmount = LibMarket.buyAndSow(buyAmount, ethAmount);
        return _sowBeans(boughtAmount.add(amount), false);
    }

    function sowBeans(uint256 amount) external returns (uint256) {
        amount = getSowAmount(amount);
        return _sowBeans(amount, true);
    }

    function buyAndSowBeans(uint256 amount, uint256 buyAmount) public payable returns (uint256) {
        uint256 ethAmount;
        (amount, buyAmount, ethAmount) = getBuyAndSowAmount(amount, buyAmount, msg.value);
        uint256 boughtAmount = LibMarket.buyAndSow(buyAmount, ethAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        return _sowBeans(boughtAmount.add(amount), false);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocateBeans(transferBeans);
    }

    function getSowAmount(uint256 amount) private view returns (uint256 maxSowAmount) {
        maxSowAmount = s.f.soil;
        require(maxSowAmount > 0 && amount > 0, "Field: Sowing no pods.");
        if (amount < maxSowAmount) return amount;
    }

    function getBuyAndSowAmount(uint256 amount, uint256 buyAmount, uint256 ethAmount) 
        private 
        view 
        returns (uint256 maxSowAmount, uint256 sowBuyAmount, uint256 sowEthAmount) 
    {
        maxSowAmount = s.f.soil;
        require(maxSowAmount > 0 && amount.add(buyAmount) > 0, "Field: Sowing no pods.");
        if (amount.add(buyAmount) <= maxSowAmount) return (amount, buyAmount, ethAmount);
        if (amount < maxSowAmount) {
            sowBuyAmount = maxSowAmount.sub(amount);
            sowEthAmount = (ethAmount.sub(1)).mul(sowBuyAmount).div(buyAmount).add(1);
            return (amount, sowBuyAmount, sowEthAmount);
        }
    }
}
