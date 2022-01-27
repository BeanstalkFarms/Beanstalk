/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./POLDibbler.sol";
import "../../../libraries/LibClaim.sol";

/**
 * @author Publius
 * @title LPField sows LP.
**/
contract LPFieldFacet is POLDibbler {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    function claimAndSowLP(uint256 amount, LibClaim.Claim calldata claim) public returns(uint256) {
        LibClaim.claim(claim);
        return _sowLP(amount);
    }

    function claimAddAndSowLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibClaim.Claim calldata claim
    )
        external payable
    {
        LibClaim.claim(claim);
        _addAndSowLP(lp, buyBeanAmount, buyEthAmount, al);
    }

    function sowLP(uint256 amount) public returns (uint256) {
        pair().transferFrom(msg.sender, address(this), amount);
        return _sowLP(amount);
    }

    /// @notice Sows both LP and Beans simultaneously into the Field while also creating POL
    /// @param bean_amount Designated amount of Beans to sow
    /// @param lp_amount Designated amount of LPs to sow 
    /// 
    function sowLPAndBeans(uint256 lp_amount, uint256 bean_amount) public returns(uint256) {
        bean().transferFrom(msg.sender, address(this), bean_amount);
        pair().transferFrom(msg.sender, address(this), lp_amount);
        return _sowLPAndBeans(lp_amount, bean_amount);
    }

    function addAndSowLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        public
        payable
        returns (uint256)
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        return _addAndSowLP(lp, buyBeanAmount, buyEthAmount, al);
    }

    function _addAndSowLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        internal returns(uint256) {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        return _sowLP(lp.add(boughtLP));
    }

    function _sowLP(uint256 amount) internal returns(uint256) {
        return _sowPOL(amount, lpToLPBeans(amount));
    }

    /// @notice Sow both LP and Beans simultaneously into the Field
    /// @param bean_amount Designated amount of Beans to sow
    /// @param lp_amount Designated amount of LPs to sow 
    ///  
    function _sowLPAndBeans(uint256 lp_amount, uint256 bean_amount) internal returns (uint256) {
        bean().burn(bean_amount);
        LibCheck.beanBalanceCheck();
        require(intPrice() > 0, "POLField: Price < 1.");
        uint256 amount = lpToLPBeans(lp_amount).add(bean_amount);
        uint256 pods = LibDibbler.sow(amount, msg.sender);
        // emit AddPOL(msg.sender, s.c.pair, lp_amount);
        // bean().burn(amount);
        // LibCheck.beanBalanceCheck();
        return pods;
    }

    /**
     * Shed
    **/

    function reserves() internal view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return (s.index == 0 ? reserve1 : reserve0,s.index == 0 ? reserve0 : reserve1);
    }

    function lpToLPBeans(uint256 amount) internal view returns (uint256) {
        (,uint256 beanReserve) = reserves();
        return amount.mul(beanReserve).mul(2).div(pair().totalSupply());
    }

}
