/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/Convert/LibConvert.sol";
import "~/libraries/LibInternal.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
 **/
contract ConvertFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

    event RemoveDeposits(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256[] amounts,
        uint256 amount
    );

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
    }

    function convert(
        bytes calldata convertData,
        int32[] memory cumulativeGrownStalks,
        uint256[] memory amounts
    )
        external
        payable
        nonReentrant
        returns (uint32 toSeason, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    {
        LibInternal.mow(msg.sender);

        address toToken; address fromToken; uint256 grownStalk;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(
            convertData
        );

        (grownStalk, fromBdv) = _withdrawTokens(
            fromToken,
            crates,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toSeason = _depositTokens(toToken, toAmount, toBdv, grownStalk);

        emit Convert(msg.sender, fromToken, toToken, fromAmount, toAmount);
    }

    function _withdrawTokens(
        address token,
        int32[] memory cumulativeGrownStalks,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256, uint256) {
        require(
            cumulativeGrownStalks.length == amounts.length,
            "Convert: cumulativeGrownStalks, amounts are diff lengths."
        );
        AssetsRemoved memory a;
        uint256 depositBDV;
        uint256 i = 0;
        while ((i < cumulativeGrownStalks.length) && (a.tokensRemoved < maxTokens)) {
            if (a.tokensRemoved.add(amounts[i]) < maxTokens)
                depositBDV = LibTokenSilo.removeDepositFromAccount(
                    msg.sender,
                    token,
                    cumulativeGrownStalks[i],
                    amounts[i]
                );
            else {
                amounts[i] = maxTokens.sub(a.tokensRemoved);
                depositBDV = LibTokenSilo.removeDepositFromAccount(
                    msg.sender,
                    token,
                    cumulativeGrownStalks[i],
                    amounts[i]
                );
            }
            a.tokensRemoved = a.tokensRemoved.add(amounts[i]);
            a.bdvRemoved = a.bdvRemoved.add(depositBDV);
            a.stalkRemoved = a.stalkRemoved.add(LibTokenSilo.grownStalkForDeposit(msg.sender, token, cumulativeGrownStalks[i]));
            
            i++;
        }
        for (i; i < cumulativeGrownStalks.length; ++i) amounts[i] = 0;
        emit RemoveDeposits(
            msg.sender,
            token,
            cumulativeGrownStalks,
            amounts,
            a.tokensRemoved
        );

        require(
            a.tokensRemoved == maxTokens,
            "Convert: Not enough tokens removed."
        );
        LibTokenSilo.decrementTotalDeposited(token, a.tokensRemoved);
        LibSilo.burnStalk(
            msg.sender,
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalk))
        );
        return (a.stalkRemoved, a.bdvRemoved);
    }

    function _depositTokens(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk
    ) internal returns (uint32 _s) {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

        
        uint256 stalk = bdv.mul(LibTokenSilo.stalk(token)).add(grownStalk);
        LibSilo.mintStalk(msg.sender, stalk);

        LibTokenSilo.incrementTotalDeposited(token, amount);
        LibTokenSilo.addDepositToAccount(msg.sender, token, _s, amount, bdv);
    }

    function getMaxAmountIn(address tokenIn, address tokenOut)
        external
        view
        returns (uint256 amountIn)
    {
        return LibConvert.getMaxAmountIn(tokenIn, tokenOut);
    }

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return LibConvert.getAmountOut(tokenIn, tokenOut, amountIn);
    }
}
