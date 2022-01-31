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
import "../../../libraries/Silo/LibLegacyLPSilo.sol";

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
     * Stalk ERC-20 Functions
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

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim) external {
        allocateBeans(claim, amount);
        _depositBeans(amount, defaultSettings());
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
        _depositBeans(boughtAmount.add(amount), defaultSettings());
    }

    function depositBeans(uint256 amount) public {
        bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(amount, defaultSettings());
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount) public payable {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(boughtAmount.add(amount), defaultSettings());
    }

    // Withdraw

    function withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts
    )
        external
    {
        _withdrawBeans(crates, amounts, defaultSettings());
    }

    function claimAndWithdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(claim);
        _withdrawBeans(crates, amounts, defaultSettings());
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
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        LibClaim.claim(claim);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, claim, defaultSettings());
    }

    function depositLP(uint256 amount) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _deposit(s.c.pair, amount, defaultSettings());
    }

    function addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata c
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, c, defaultSettings());
    }

    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata c,
        Storage.Settings memory set
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _deposit(s.c.pair, lp.add(boughtLP), set);
    }

    /*
     * Withdraw legacy
    */

    function claimAndWithdrawLegacyLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        bool[] calldata legacy,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(claim);
        LibLegacyLPSilo.withdrawLegacyLP(crates, amounts, legacy);
    }

    function withdrawLegacyLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        bool[] calldata legacy
    )
        external
    {
        LibLegacyLPSilo.withdrawLegacyLP(crates, amounts, legacy);
    }

    /*
     * Shed
     */

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c);
        LibMarket.allocatedBeans(transferBeans);
    }

    function uniswapLPtoBDV(address lp_address, uint256 amount) external payable returns (uint256) {
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(lp_address).getReserves();
        // We might want to deprecate s.index
        uint256 beanReserve = s.index == 0 ? reserve0 : reserve1;
        return amount.mul(beanReserve).mul(2).div(IUniswapV2Pair(lp_address).totalSupply());
    }
}
