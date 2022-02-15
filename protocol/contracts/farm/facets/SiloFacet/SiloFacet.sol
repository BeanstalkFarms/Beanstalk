/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
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
    using SafeMath for uint32;

    /*
     * Bean
    */

    // Deposit

    function claimAndDepositBeans(
        bool partialUpdateSilo,
        uint256 amount,
        LibClaim.Claim calldata claim
    ) external {
        allocateBeans(claim, amount, partialUpdateSilo);
        _depositBeans(partialUpdateSilo, amount);
    }

    function claimBuyAndDepositBeans(
        bool partialUpdateSilo,
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        allocateBeans(claim, amount, partialUpdateSilo);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        _depositBeans(partialUpdateSilo, boughtAmount.add(amount));
    }

    function depositBeans(bool partialUpdateSilo, uint256 amount) public {
        bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(partialUpdateSilo, amount);
    }

    function buyAndDepositBeans(bool partialUpdateSilo, uint256 amount, uint256 buyAmount) public payable {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(partialUpdateSilo, boughtAmount.add(amount));
    }

    // Withdraw

    function withdrawBeans(
        bool partialUpdateSilo,
        uint32[] calldata crates,
        uint256[] calldata amounts
    )
        external
    {
        _withdrawBeans(partialUpdateSilo, crates, amounts);
    }

    function claimAndWithdrawBeans(
        bool partialUpdateSilo,
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _withdrawBeans(partialUpdateSilo, crates, amounts);
    }

    /*
     * LP
    */

    function claimAndDepositLP(bool partialUpdateSilo, uint256 amount, LibClaim.Claim calldata claim) external {
        LibClaim.claim(partialUpdateSilo, claim);
        depositLP(partialUpdateSilo, amount);
    }

    function claimAddAndDepositLP(
        bool partialUpdateSilo,
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	    LibClaim.Claim calldata claim
    )
        external
        payable
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _addAndDepositLP(partialUpdateSilo, lp, buyBeanAmount, buyEthAmount, al);
    }

    function depositLP(bool partialUpdateSilo, uint256 amount) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(partialUpdateSilo, amount);
    }

    function addAndDepositLP(
        bool partialUpdateSilo,
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(partialUpdateSilo, lp, buyBeanAmount, buyEthAmount, al);
    }
    
    function _addAndDepositLP(
        bool partialUpdateSilo,
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(partialUpdateSilo, lp.add(boughtLP));
    }

    /*
     * Withdraw
    */

    function claimAndWithdrawLP(
        bool partialUpdateSilo,
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _withdrawLP(partialUpdateSilo, crates, amounts);
    }

    function withdrawLP(
        bool partialUpdateSilo,
        uint32[] calldata crates, 
        uint256[] calldata amounts
    )
        external
    {
        _withdrawLP(partialUpdateSilo, crates, amounts);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, bool partialUpdateSilo) private {
        LibClaim.claim(partialUpdateSilo, c);
        LibMarket.allocateBeans(transferBeans);
    }
}
