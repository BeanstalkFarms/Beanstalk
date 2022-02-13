/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanDibbler.sol";
import "../../../libraries/LibClaim.sol";
import '../../../libraries/LibUserBalance.sol';

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
        returns (uint256)
    {
        allocateBeans(claim, amount);
        return _sowBeans(amount);
    }

    function claimBuyAndSowBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim,
	Storage.Settings calldata set
    )
        external
        payable
        returns (uint256)
    {
        allocateBeans(claim, amount);
	address[] memory path = new address[](2);
	path[0] = s.c.weth;
	path[1] = s.c.bean;
	uint256[] memory amounts = LibUniswap.swapExactETHForTokens(buyAmount, path, address(this), block.timestamp.add(1), set); //{value: msg.value}
	(bool success,) = msg.sender.call{ value: msg.value.sub(amounts[0]) }("");
	require(success, "Field: Refund failed.");
        return _sowBeans(amount.add(amounts[1]));
    }

    function sowBeans(uint256 amount) external returns (uint256) {
        bean().transferFrom(msg.sender, address(this), amount);
        return _sowBeans(amount);
    }

    function buyAndSowBeans(uint256 amount, uint256 buyAmount, Storage.Settings calldata set) public payable returns (uint256) {
	address[] memory path = new address[](2);
        path[0] = s.c.weth;
        path[1] = s.c.bean;
        uint256[] memory amounts = LibUniswap.swapExactETHForTokens(buyAmount, path, address(this), block.timestamp.add(1), set); //{value: msg.value}
        (bool success,) = msg.sender.call{ value: msg.value.sub(amounts[0]) }("");
        require(success, "Field: Refund failed.");
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        return _sowBeans(amount.add(amounts[1]));
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibUserBalance.allocatedBeans(transferBeans);
    }

}
