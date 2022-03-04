/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./ConvertWithdraw.sol";
import "../../../libraries/Convert/LibConvert.sol";
import "../../../libraries/LibClaim.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
**/
contract ConvertFacet is ConvertWithdraw {

    using SafeMath for uint256;
    using SafeMath for uint32;

    function convert(
        bytes calldata userData,
        uint32[] memory crates,
        uint256[] memory amounts,
        bool partialUpdateSilo
    )
        external 
    {
        LibInternal.updateSilo(msg.sender, partialUpdateSilo);

        (
            address toToken,
            address fromToken,
            uint256 toTokenAmount,
            uint256 fromTokenAmount,
            uint256 bdv
        ) = LibConvert.convert(userData);
        // console.log("From: %s, To: %s", fromToken, toToken);
        // console.log("Bean: %s", s.c.bean);
        // console.log("From: %s, To: %s", fromTokenAmount, toTokenAmount);

        (
            uint256 tokensRemoved, 
            uint256 stalkRemoved
        ) = _withdrawForConvert(fromToken, crates, amounts, fromTokenAmount);

        _depositTokens(toToken, toTokenAmount, bdv, stalkRemoved);

        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function claimConvertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        bool partialUpdateSilo,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        LibClaim.claim(partialUpdateSilo, claim);
        _convertAddAndDepositLP(lp, al, crates, amounts, partialUpdateSilo);
    }

    function convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        bool partialUpdateSilo
    )
        public
        payable
    {
        _convertAddAndDepositLP(lp, al, crates, amounts, partialUpdateSilo);
    }

    function _convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory seasons,
        uint256[] memory amounts,
        bool partialUpdateSilo
    )
        internal
    {
	    LibInternal.updateSilo(msg.sender, partialUpdateSilo);
        WithdrawState memory w;
        if (bean().balanceOf(address(this)) < al.beanAmount) {
            w.beansTransferred = al.beanAmount.sub(s.bean.deposited);
            bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al); // w.beansAdded is beans added to LP
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(seasons, amounts, w.beansAdded); // w.beansRemoved is beans removed from Silo
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred) {
            bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
	    } else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.allocateBeans(transferAmount);
        }

        w.i = w.stalkRemoved.div(LibLPSilo.lpToLPBeans(lp.add(w.newLP)), "Silo: No LP Beans.");
        uint32 seasonseason = uint32(season().sub(w.i.div(C.getSeedsPerLPBean())));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);
	
        lp = lp.add(w.newLP);
        _depositLP(lp, LibLPSilo.lpToLPBeans(lp), seasonseason);
        LibCheck.beanBalanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function lpToPeg(address pair) external view returns (uint256 lp) {
        if (pair == C.uniswapV2PairAddress()) return LibUniswapConvert.lpToPeg();
        else if (pair == C.curveMetapoolAddress()) return LibCurveConvert.lpToPeg();
        require(false, "Convert: Pool not supported");
    }

    function beansToPeg(address pair) external view returns (uint256 beans) {
        if (pair == C.uniswapV2PairAddress()) return LibUniswapConvert.beansToPeg();
        else if (pair == C.curveMetapoolAddress()) return LibCurveConvert.beansToPeg();
        require(false, "Convert: Pool not supported");
    }
}
