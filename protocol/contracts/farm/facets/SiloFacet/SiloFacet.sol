/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";
import "../../../libraries/LibClaim.sol";
import '../../../libraries/LibUserBalance.sol';
import '../../../libraries/LibUniswap.sol';
import '../../../libraries/LibLiquity.sol';

/*
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
*/
contract SiloFacet is BeanSilo {

    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;
    using SafeMath for uint32;

    /*
     * Bean
    */

    // Deposit

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim) external {
        allocateBeans(claim, amount);
        _depositBeans(amount);
    }

    function claimBuyAndDepositBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim,
	Storage.Settings calldata set
    )
        external
        payable
    {
        allocateBeans(claim, amount);
	address[] memory path = new address[](2);
	path[0] = s.c.weth;
	path[1] = s.c.bean;
	uint256[] memory amounts = LibUniswap.swapExactETHForTokens(buyAmount, path, address(this), block.timestamp.add(1), set);
	(bool success,) = msg.sender.call{ value: msg.value.sub(amounts[0]) }("");
	require(success, "Silo: Refund failed.");
        uint256 boughtAmount = amounts[1];
        _depositBeans(boughtAmount.add(amount));
    }

    function depositBeans(uint256 amount) public {
        bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(amount);
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount, Storage.Settings calldata set) public payable {
	address[] memory path = new address[](2);
	path[0] = s.c.weth;
	path[1] = s.c.bean;
	uint256[] memory amounts = LibUniswap.swapExactETHForTokens(buyAmount, path, address(this), block.timestamp.add(1), set); //{value: msg.value}
	(bool success,) = msg.sender.call{ value: msg.value.sub(amounts[0]) }("");
	require(success, "Field: Refund failed.");
        uint256 boughtAmount = amounts[1];
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(boughtAmount.add(amount));
    }

    // Withdraw

    function withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts
    )
        external
    {
        _withdrawBeans(crates, amounts);
    }

    function claimAndWithdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(claim);
        _withdrawBeans(crates, amounts);
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, LibClaim.Claim calldata claim) external {
        LibClaim.claim(claim);
        depositLP(amount);
    }

    function claimAddAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibUniswap.AddLiquidity calldata al,
	LibClaim.Claim calldata claim,
	Storage.Settings calldata set
    )
        external
        payable
    {
        LibClaim.claim(claim);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, set);
    }

    function depositLP(uint256 amount) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount);
    }

    function addAndDepositLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibUniswap.AddLiquidity calldata al,
	Storage.Settings calldata set
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, set);
    }
    
    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibUniswap.AddLiquidity calldata al,
	Storage.Settings calldata set
    )
        internal {
	uint256 boughtLP = LibUniswap.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al, set);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP));
    }

    /*
     * Withdraw
    */

    function claimAndWithdrawLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(claim);
        _withdrawLP(crates, amounts);
    }

    function withdrawLP(
        uint32[] calldata crates, uint256[]
        calldata amounts
    )
        external
    {
        _withdrawLP(crates, amounts);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibUserBalance.allocatedBeans(transferBeans);
    }

    /*
     * Collateralize
    */ 

   function collateralize(uint256 maxFeeAmount, uint256 lusdWithdrawAmount) public payable {
	LibLiquity.collateralize(maxFeeAmount, lusdWithdrawAmount);
   }
}
