/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../../libraries/Silo/LibSilo.sol";
import "../../libraries/Silo/LibTokenSilo.sol";
import "../../libraries/LibSafeMath32.sol";
import "../../libraries/Convert/LibConvert.sol";
import "../../libraries/LibInternal.sol";
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
        uint32[] memory crates,
        uint256[] memory amounts
    )
        external
        payable
        nonReentrant
        returns (uint32 toSeason, uint256 toAmount)
    {
        LibInternal.updateSilo(msg.sender);

        address toToken; address fromToken; uint256 fromAmount;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(
            convertData
        );

        (uint256 grownStalk, uint256 oldBdv) = _withdrawTokens(
            fromToken,
            crates,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        uint256 bdv = newBdv > oldBdv ? newBdv : oldBdv;

        toSeason = _depositTokens(toToken, toAmount, bdv, grownStalk);

        emit Convert(msg.sender, fromToken, toToken, fromAmount, toAmount);
    }

    function _withdrawTokens(
        address token,
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256, uint256) {
        require(
            seasons.length == amounts.length,
            "Convert: seasons, amounts are diff lengths."
        );
        AssetsRemoved memory a;
        uint256 depositBDV;
        uint256 i = 0;
        while ((i < seasons.length) && (a.tokensRemoved < maxTokens)) {
            if (a.tokensRemoved.add(amounts[i]) < maxTokens)
                depositBDV = LibTokenSilo.removeDeposit(
                    msg.sender,
                    token,
                    seasons[i],
                    amounts[i]
                );
            else {
                amounts[i] = maxTokens.sub(a.tokensRemoved);
                depositBDV = LibTokenSilo.removeDeposit(
                    msg.sender,
                    token,
                    seasons[i],
                    amounts[i]
                );
            }
            a.tokensRemoved = a.tokensRemoved.add(amounts[i]);
            a.bdvRemoved = a.bdvRemoved.add(depositBDV);
            a.stalkRemoved = a.stalkRemoved.add(
                depositBDV.mul(s.season.current - seasons[i])
            );
            i++;
        }
        for (i; i < seasons.length; ++i) amounts[i] = 0;
        emit RemoveDeposits(
            msg.sender,
            token,
            seasons,
            amounts,
            a.tokensRemoved
        );

        require(
            a.tokensRemoved == maxTokens,
            "Convert: Not enough tokens removed."
        );
        a.stalkRemoved = a.stalkRemoved.mul(s.ss[token].seeds);
        LibTokenSilo.decrementDepositedToken(token, a.tokensRemoved);
        LibSilo.withdrawSiloAssets(
            msg.sender,
            a.bdvRemoved.mul(s.ss[token].seeds),
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

        uint256 seeds = bdv.mul(LibTokenSilo.seeds(token));
        if (grownStalk > 0) {
            _s = uint32(grownStalk.div(seeds));
            uint32 __s = s.season.current;
            if (_s >= __s) _s = __s - 1;
            grownStalk = uint256(_s).mul(seeds);
            _s = __s - _s;
        } else _s = s.season.current;
        uint256 stalk = bdv.mul(LibTokenSilo.stalk(token)).add(grownStalk);
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);

        LibTokenSilo.incrementDepositedToken(token, amount);
        LibTokenSilo.addDeposit(msg.sender, token, _s, amount, bdv);
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
