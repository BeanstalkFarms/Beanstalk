/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibUserBalance.sol";

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
        uint256 amount,
        bool partialUpdateSilo,
        LibClaim.Claim calldata claim
    ) external {
        allocateBeans(claim, amount, partialUpdateSilo);
        _depositBeans(amount, partialUpdateSilo);
    }

    function claimBuyAndDepositBeans(
        uint256 amount,
        uint256 buyAmount,
        bool partialUpdateSilo,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        allocateBeans(claim, amount, partialUpdateSilo);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        _depositBeans(boughtAmount.add(amount), partialUpdateSilo);
    }

    function depositBeans(uint256 amount, UpdateSettings calldata settings) public {
        if (!settings.fromInternalBalance) bean().transferFrom(msg.sender, address(this), amount);
        else LibUserBalance._decreaseInternalBalance(msg.sender, bean(), amount, false);
        _depositBeans(amount, settings.partialUpdateSilo);
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount, bool partialUpdateSilo) public payable {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(boughtAmount.add(amount), partialUpdateSilo);
    }

    // Withdraw

    function withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        bool partialUpdateSilo
    )
        external
    {
        _withdrawBeans(crates, amounts, partialUpdateSilo);
    }

    function claimAndWithdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        bool partialUpdateSilo,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _withdrawBeans(crates, amounts, partialUpdateSilo);
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, bool partialUpdateSilo, LibClaim.Claim calldata claim) external {
        LibClaim.claim(partialUpdateSilo, claim);
        depositLP(amount, partialUpdateSilo);
    }

    function claimAddAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        bool partialUpdateSilo,
        LibMarket.AddLiquidity calldata al,
	    LibClaim.Claim calldata claim
    )
        external
        payable
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, partialUpdateSilo, al);
    }

    function depositLP(uint256 amount, bool partialUpdateSilo) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount, partialUpdateSilo);
    }

    function addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        bool partialUpdateSilo,
        LibMarket.AddLiquidity calldata al
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, partialUpdateSilo, al);
    }
    
    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        bool partialUpdateSilo,
        LibMarket.AddLiquidity calldata al
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP), partialUpdateSilo);
    }

    /*
     * Withdraw
    */

    function claimAndWithdrawLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        bool partialUpdateSilo,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _withdrawLP(crates, amounts, partialUpdateSilo);
    }

    function withdrawLP(
        uint32[] calldata crates, 
        uint256[] calldata amounts,
        bool partialUpdateSilo
    )
        external
    {
        _withdrawLP(crates, amounts, partialUpdateSilo);
    }

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans, bool partialUpdateSilo) private {
        LibClaim.claim(partialUpdateSilo, c);
        LibMarket.allocateBeans(transferBeans);
    }

    function uniswapLPtoBDV(address lp_address, uint256 amount) external payable returns (uint256) {
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(lp_address).getReserves();
        // We might want to deprecate s.index
        uint256 beanReserve = s.index == 0 ? reserve0 : reserve1;
        return amount.mul(beanReserve).mul(2).div(IUniswapV2Pair(lp_address).totalSupply());
    }
}
