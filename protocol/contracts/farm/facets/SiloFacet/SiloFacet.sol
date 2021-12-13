/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibConvert.sol";

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
        updateSilo(LibStalk._msgSender());
        updateSilo(recipient);
        LibStalk._transfer(LibStalk._msgSender(), recipient, amount);
        return true;
    }

    /// @notice transfer function that allows the caller to send a specified amount of Stalk ERC-20 tokens to
    ///         another wallet address from another specified address's wallet
    /// @param sender The address of the selected sender address of the Stalk tokens
    /// @param recipient The address of the selected recipient address of the sent Stalk tokens
    /// @param amount The amount of stalk tokens to transfer to the recipient account from the sender account
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        updateSilo(sender);
        updateSilo(recipient);
        LibStalk._transfer(sender, recipient, amount);
        if (allowance(sender, LibStalk._msgSender()) != uint256(-1)) {
            LibStalk._approve(
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

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim) external {
        allocateBeans(claim, amount);
        _depositBeans(amount);
    }

    function claimBuyAndDepositBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        allocateBeans(claim, amount);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        _depositBeans(boughtAmount.add(amount));
    }

    function depositBeans(uint256 amount) public {
        bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(amount);
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount) public payable {
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
        LibClaim.claim(claim, claim.beansToWallet);
        _withdrawBeans(crates, amounts);
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, LibClaim.Claim calldata claim) external {
        LibClaim.claim(claim, claim.beansToWallet);
        depositLP(amount);
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
    {
        LibClaim.claim(claim, 0);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, claim);
    }

    function depositLP(uint256 amount) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount);
    }

    function addAndDepositLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	    LibClaim.Claim calldata c
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, c);
    }
    
    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	    LibClaim.Claim calldata c
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al, c.beansToWallet);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP));
    }

    function claimConvertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        _convertAddAndDepositLP(lp, al, crates, amounts, LibClaim.claim(claim, true));
    }

    function convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        public
        payable
    {
        _convertAddAndDepositLP(lp, al, crates, amounts, 0);
    }

    function _convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 allocatedBeans
    )
        private
    {
        updateSilo(msg.sender);
        WithdrawState memory w;
        if (IBean(s.c.bean).balanceOf(address(this)) < al.beanAmount) {
            w.beansTransferred = al.beanAmount.sub(totalDepositedBeans());
            bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al);
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(crates, amounts, w.beansAdded);
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred)
            bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet).add(allocatedBeans));
        else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.transferAllocatedBeans(allocatedBeans, transferAmount);
        }
        w.i = w.stalkRemoved.div(lpToLPBeans(lp.add(w.newLP)), "Silo: No LP Beans.");

        uint32 depositSeason = uint32(season().sub(w.i.div(C.getSeedsPerLPBean())));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);

        _depositLP(lp.add(w.newLP), depositSeason);
        LibCheck.beanBalanceCheck();
        updateBalanceOfRainStalk(msg.sender);
    }

    /**
     * Withdraw
    */

    function claimAndWithdrawLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(claim, claim.beansToWallet);
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
        LibClaim.claim(c, 0);
        LibMarket.transferAllocatedBeans(transferBeans, c.beansToWallet);
    }
}
