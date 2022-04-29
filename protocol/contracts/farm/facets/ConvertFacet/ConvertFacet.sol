/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./ConvertWithdraw.sol";
import "../../../libraries/Convert/LibConvert.sol";
import "../../../libraries/LibClaim.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
**/
contract ConvertFacet is ConvertWithdraw {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    function convert(
        bytes calldata userData,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        external 
    {
        LibInternal.updateSilo(msg.sender);

        (
            address toToken,
            address fromToken,
            uint256 toTokenAmount,
            uint256 fromTokenAmount,
            uint256 bdv
        ) = LibConvert.convert(userData);

        (uint256 grownStalk) = _withdrawForConvert(fromToken, crates, amounts, fromTokenAmount);

        _depositTokens(toToken, toTokenAmount, bdv, grownStalk);

        LibSilo.updateBalanceOfRainStalk(msg.sender);
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
        LibClaim.claim(claim);
        _convertAddAndDepositLP(lp, al, crates, amounts);
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
        _convertAddAndDepositLP(lp, al, crates, amounts);
    }

    function _convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory seasons,
        uint256[] memory amounts
    )
        internal
    {
	    LibInternal.updateSilo(msg.sender);
        WithdrawState memory w;
        if (C.bean().balanceOf(address(this)) < al.beanAmount) {
            w.beansTransferred = al.beanAmount.sub(s.bean.deposited);
            C.bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al); // w.beansAdded is beans added to LP
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = __withdrawBeansForConvert(seasons, amounts, w.beansAdded); // w.beansRemoved is beans removed from Silo
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred) {
            C.bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
	    } else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.allocateBeans(transferAmount);
        }

        if (lp > 0) C.uniswapV2Pair().transferFrom(msg.sender, address(this), lp);
	
        lp = lp.add(w.newLP);
        _depositTokens(s.c.pair, lp, LibBeanEthUniswap.bdv(lp), w.stalkRemoved);
        LibCheck.beanBalanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }

    function lpToPeg(address pair) external view returns (uint256 lp) {
        if (pair == C.uniswapV2PairAddress()) return LibUniswapConvert.lpToPeg();
        else if (pair == C.curveMetapoolAddress()) return LibCurveConvert.lpToPeg(C.curveMetapoolAddress());
        else if (pair == C.curveBeanLUSDAddress()) return LibCurveConvert.lpToPeg(C.curveBeanLUSDAddress());
        require(false, "Convert: Pool not supported");
    }

    function beansToPeg(address pair) external view returns (uint256 beans) {
        if (pair == C.uniswapV2PairAddress()) return LibUniswapConvert.beansToPeg();
        else if (pair == C.curveMetapoolAddress()) return LibCurveConvert.beansToPeg(C.curveMetapoolAddress());
        else if (pair == C.curveBeanLUSDAddress()) return LibCurveConvert.beansToPeg(C.curveBeanLUSDAddress());
        require(false, "Convert: Pool not supported");
    }
}
