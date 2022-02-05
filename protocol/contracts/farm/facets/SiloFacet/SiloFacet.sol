/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/Silo/LibLegacyLPSilo.sol";

/*
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
*/
contract SiloFacet is TokenSilo {

    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;
    using SafeMath for uint32;


    /*
     * Generic
     */

    function deposit(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _deposit(token, amount);
    }

    function claimAndDeposit(address token, uint256 amount, LibClaim.Claim calldata claim) external {
        LibClaim.claim(claim);
        _deposit(C.beanAddress(), amount);
    }

    function withdraw(address token, uint32[] calldata seasons, uint256[] calldata amounts) public {
        _withdraw(token, seasons, amounts);
    }

    function claimAndWithdraw(address token, uint32[] calldata seasons, uint256[] calldata amounts, LibClaim.Claim calldata claim) public {
        LibClaim.claim(claim);
        _withdraw(token, seasons, amounts);
    }

    /*
     * Bean
    */

    // Deposit

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim) external {
        allocateBeans(claim, amount);
        _deposit(C.beanAddress(), amount);
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
        _deposit(C.beanAddress(), boughtAmount.add(amount));
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount) public payable {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) C.bean().transferFrom(msg.sender, address(this), amount);
        _deposit(C.beanAddress(), boughtAmount.add(amount));
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, LibClaim.Claim calldata claim) external {
        LibClaim.claim(claim);
        _deposit(s.c.pair, amount);
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
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al);
    }

    function addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Cant buy Ether and Beans.");
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
        _deposit(s.c.pair, lp.add(boughtLP));
    }

    /*
     * Withdraw legacy LP
    */

    function claimAndWithdrawLegacyLP(
        uint32[] calldata seasons,
        uint256[] calldata amounts,
        bool[] calldata legacy,
        LibClaim.Claim calldata claim
    )
        external
    {
        LibClaim.claim(claim);
        LibLegacyLPSilo.withdrawLegacyLP(seasons, amounts, legacy);
    }

    function withdrawLegacyLP(
        uint32[] calldata seasons,
        uint256[] calldata amounts,
        bool[] calldata legacy
    )
        external
    {
        LibLegacyLPSilo.withdrawLegacyLP(seasons, amounts, legacy);
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
