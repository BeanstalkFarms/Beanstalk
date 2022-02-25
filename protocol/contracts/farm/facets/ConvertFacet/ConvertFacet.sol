/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./ConvertWithdraw.sol";
import "../../../libraries/LibConvert.sol";
import "../../../libraries/LibClaim.sol";

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

        (
            uint256 tokensRemoved, 
            uint256 stalkRemoved
        ) = _withdrawTokensForConvert(fromToken, crates, amounts, fromTokenAmount);

        _depositTokens(toToken, toTokenAmount, bdv, stalkRemoved);

        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }  

    function convertDepositedBeans(
        bytes calldata userData,
        uint32[] memory crates,
        uint256[] memory amounts,
        bool partialUpdateSilo
    )
        external 
    {
        LibInternal.updateSilo(msg.sender, partialUpdateSilo);
        (uint256 lp, uint256 beansConverted) = LibConvert.sellToPegAndAddLiquidity(userData);
        (uint256 beansRemoved, uint256 stalkRemoved) = _withdrawBeansForConvert(crates, amounts, beansConverted);
        require(beansRemoved == beansConverted, "Silo: Wrong Beans removed.");
        uint32 _s = uint32(stalkRemoved.div(beansConverted.mul(C.getSeedsPerLPBean())));
        _s = getDepositSeason(_s);

        _depositLP(lp, beansConverted, _s);
        LibCheck.balanceCheck();
        LibSilo.updateBalanceOfRainStalk(msg.sender);
    }   

    function convertDepositedLP(
        bytes calldata userData,
        uint32[] memory crates,
        uint256[] memory amounts,
        bool partialUpdateSilo
    )
        external
    {
        LibInternal.updateSilo(msg.sender, partialUpdateSilo);
        (uint256 beans, uint256 lpConverted) = LibConvert.removeLPAndBuyToPeg(userData);
        (uint256 lpRemoved, uint256 stalkRemoved) = _withdrawLPForConvert(crates, amounts, lpConverted);
        require(lpRemoved == lpConverted, "Silo: Wrong LP removed.");
        uint32 _s = uint32(stalkRemoved.div(beans.mul(C.getSeedsPerBean())));
        _s = getDepositSeason(_s);
        _depositBeans(beans, _s);
        LibCheck.balanceCheck();
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

    function lpToPeg() external view returns (uint256 lp) {
        return LibConvert.lpToPeg();
    }

    function beansToPeg() external view returns (uint256 beans) {
        (uint256 ethReserve, uint256 beanReserve) = reserves();
        return LibConvert.beansToPeg(ethReserve, beanReserve);
    }
}
