/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibConvert.sol";
import "../../../interfaces/ISeed.sol";

/*
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
*/
contract SiloFacet is BeanSilo {

    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;
    using SafeMath for uint32;

    /*
    /**
     * Stalk
    **/
    
    /// @notice Transfer any amount of Stalk ERC-20 tokens to another wallet address
    /// @param recipient The address of the recipient of the Stalk tokens
    /// @param amount The amount of stalk tokens to transfer to the recipient
    function transfer(address recipient, uint256 amount) public returns (bool) {
        updateSilo(LibStalk._msgSender(), false, false);
        updateSilo(recipient, false, false);
        LibStalk.transfer(LibStalk._msgSender(), recipient, amount);
        return true;
    }

    /// @notice transfer function that allows the caller to send a specified amount of Stalk ERC-20 tokens to
    ///         another wallet address from another specified address's wallet
    /// @param sender The address of the selected sender address of the Stalk tokens
    /// @param recipient The address of the selected recipient address of the sent Stalk tokens
    /// @param amount The amount of stalk tokens to transfer to the recipient account from the sender account
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        updateSilo(sender, false, false);
        updateSilo(recipient, false, false);
        LibStalk.transfer(sender, recipient, amount);
        if (allowance(sender, LibStalk._msgSender()) != uint256(-1)) {
            LibStalk.approve(
                sender,
                LibStalk._msgSender(),
                allowance(sender, LibStalk._msgSender()).sub(amount, "Stalk: Transfer amount exceeds allowance."));
        }
        return true;
    }
    
    /**
     * Bean
    */

   // Deposit

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim, Storage.Settings calldata set) external {
        allocateBeans(claim, amount);
        _depositBeans(amount, set);
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
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        _depositBeans(boughtAmount.add(amount), set);
    }

    function depositBeans(uint256 amount, Storage.Settings calldata set) public {
        bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(amount, set);
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount, Storage.Settings calldata set) public payable {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(boughtAmount.add(amount), set);
    }

    // Withdraw

    function withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
	    Storage.Settings calldata set
    )
        external
    {
        _withdrawBeans(crates, amounts, set);
    }

    function claimAndWithdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim,
	    Storage.Settings calldata set
    )
        external
    {
        LibClaim.claim(claim);
        _withdrawBeans(crates, amounts, set);
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, LibClaim.Claim calldata claim, Storage.Settings calldata set) external {
        LibClaim.claim(claim);
        depositLP(amount, set);
    }

    function claimAddAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata claim,
        Storage.Settings calldata set
    )
        external
        payable
    {
        LibClaim.claim(claim);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, claim, set);
    }

    function depositLP(uint256 amount, Storage.Settings calldata set) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount, set);
    }

    function addAndDepositLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata c,
        Storage.Settings calldata set
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, c, set);
    }

    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata c,
        Storage.Settings calldata set
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP), set);
    }

    /*
     * Withdraw
    */

    function claimAndWithdrawLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim,
	    Storage.Settings calldata set
    )
        external
    {
        LibClaim.claim(claim);
        _withdrawLP(crates, amounts, set);
    }

    function withdrawLP(
        uint32[] calldata crates, uint256[]
        calldata amounts,
	    Storage.Settings calldata set
    )
        external
    {
        _withdrawLP(crates, amounts, set);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocatedBeans(transferBeans);
    }
}
