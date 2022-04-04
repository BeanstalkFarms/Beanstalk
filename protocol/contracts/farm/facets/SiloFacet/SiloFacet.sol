/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibMarket.sol";

/*
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
*/
contract SiloFacet is BeanSilo {

    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    /*
     * Bean
    */

    // Deposit

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim) external siloNonReentrant {
        allocateBeans(claim, amount);
        _depositBeans(amount);
        LibMarket.claimRefund(claim);
    }

    function claimBuyAndDepositBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
        siloNonReentrant
    {
        allocateBeans(claim, amount);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        _depositBeans(boughtAmount.add(amount));
    }

    function depositBeans(uint256 amount) external silo {
        bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(amount);
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount) external payable siloNonReentrant {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(boughtAmount.add(amount));
    }

    // Withdraw

    function withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts
    )
        external
        silo
    {
        _withdrawBeans(crates, amounts);
    }

    function claimAndWithdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
        siloNonReentrant
    {
        LibClaim.claim(claim);
        _withdrawBeans(crates, amounts);
        LibMarket.claimRefund(claim);
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, LibClaim.Claim calldata claim) external siloNonReentrant {
        LibClaim.claim(claim);
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount);
        LibMarket.claimRefund(claim);
    }

    function claimAddAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	    LibClaim.Claim calldata claim
    )
        external
        payable
        siloNonReentrant
    {
        LibClaim.claim(claim);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al);
    }

    function depositLP(uint256 amount) external siloNonReentrant {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount);
    }

    function addAndDepositLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        external
        payable
        siloNonReentrant
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al);
    }
    
    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP));
        LibMarket.refund();
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
        siloNonReentrant
    {
        LibClaim.claim(claim);
        _withdrawLP(crates, amounts);
        LibMarket.claimRefund(claim);
    }

    function withdrawLP(
        uint32[] calldata crates, uint256[]
        calldata amounts
    )
        external
        silo
    {
        _withdrawLP(crates, amounts);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocateBeans(transferBeans);
    }
}
