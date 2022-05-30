/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../../interfaces/ICurve.sol";
import "../../libraries/Token/LibTransfer.sol";
import "../../libraries/Token/LibApprove.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Curve handles swapping and
 **/
contract CurveFacet is ReentrancyGuard {
    address private constant STABLE_FACTORY =
        0xB9fC157394Af804a3578134A6585C0dc9cc990d4;
    address private constant CRYPTO_FACTORY =
        0x0959158b6040D32d04c301A72CBFD6b39E21c9AE;

    using SafeMath for uint256;
    using LibTransfer for IERC20;
    using LibBalance for address payable;
    using LibApprove for IERC20;

    function exchange(
        address pool,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        bool stable,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        (int128 i, int128 j) = getIandJ(fromToken, toToken, pool, stable);
        amountIn = IERC20(fromToken).receiveToken(
            amountIn,
            msg.sender,
            fromMode
        );
        IERC20(fromToken).approveToken(pool, amountIn);

        if (toMode == LibTransfer.To.EXTERNAL) {
            ICurvePoolR(pool).exchange(
                i,
                j,
                amountIn,
                minAmountOut,
                msg.sender
            );
        } else {
            uint256 amountOut = ICurvePool(pool).exchange(
                i,
                j,
                amountIn,
                minAmountOut
            );
            msg.sender.increaseInternalBalance(IERC20(toToken), amountOut);
        }
    }

    function exchangeUnderlying(
        address pool,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        (int128 i, int128 j) = getUnderlyingIandJ(fromToken, toToken, pool);
        IERC20(fromToken).receiveToken(amountIn, msg.sender, fromMode);
        IERC20(fromToken).approveToken(pool, amountIn);

        if (toMode == LibTransfer.To.EXTERNAL) {
            ICurvePoolR(pool).exchange_underlying(
                i,
                j,
                amountIn,
                minAmountOut,
                msg.sender
            );
        } else {
            uint256 amountOut = ICurvePool(pool).exchange_underlying(
                i,
                j,
                amountIn,
                minAmountOut
            );
            msg.sender.increaseInternalBalance(IERC20(toToken), amountOut);
        }
    }

    function addLiquidity(
        address pool,
        uint256[] memory amounts,
        uint256 minAmountOut,
        bool stable,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        address factory = stable ? STABLE_FACTORY : CRYPTO_FACTORY;
        address[4] memory coins = ICurveFactory(factory).get_coins(pool);
        uint256 nCoins = amounts.length;
        for (uint256 i = 0; i < nCoins; ++i) {
            if (amounts[i] > 0) {
                amounts[i] = IERC20(coins[i]).receiveToken(
                    amounts[i],
                    msg.sender,
                    fromMode
                );
                IERC20(coins[i]).approveToken(pool, amounts[i]);
            }
        }
        address to = toMode == LibTransfer.To.EXTERNAL
            ? msg.sender
            : address(this);
        uint256 amountOut;
        if (nCoins == 2) {
            amountOut = ICurvePool2R(pool).add_liquidity(
                [amounts[0], amounts[1]],
                minAmountOut,
                to
            );
        } else if (nCoins == 3) {
            amountOut = ICurvePool3R(pool).add_liquidity(
                [amounts[0], amounts[1], amounts[2]],
                minAmountOut,
                to
            );
        } else {
            amountOut = ICurvePool4R(pool).add_liquidity(
                [amounts[0], amounts[1], amounts[2], amounts[3]],
                minAmountOut,
                to
            );
        }
        if (toMode == LibTransfer.To.INTERNAL)
            msg.sender.increaseInternalBalance(tokenForPool(pool), amountOut);
    }

    function removeLiquidity(
        address pool,
        uint256 amountIn,
        uint256[] calldata minAmountsOut,
        bool stable,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        IERC20 token = tokenForPool(pool);
        amountIn = token.receiveToken(amountIn, msg.sender, fromMode);
        uint256 nCoins = minAmountsOut.length;
        address to = toMode == LibTransfer.To.EXTERNAL
            ? msg.sender
            : address(this);
        uint256[] memory amounts = new uint256[](nCoins);
        if (nCoins == 2) {
            uint256[2] memory amountsOut = ICurvePool2R(pool).remove_liquidity(
                amountIn,
                [minAmountsOut[0], minAmountsOut[1]],
                to
            );
            for (uint256 i = 0; i < nCoins; i++) amounts[i] = amountsOut[i];
        } else if (nCoins == 3) {
            uint256[3] memory amountsOut = ICurvePool3R(pool).remove_liquidity(
                amountIn,
                [minAmountsOut[0], minAmountsOut[1], minAmountsOut[2]],
                to
            );
            for (uint256 i = 0; i < nCoins; i++) amounts[i] = amountsOut[i];
        } else {
            uint256[4] memory amountsOut = ICurvePool4R(pool).remove_liquidity(
                amountIn,
                [
                    minAmountsOut[0],
                    minAmountsOut[1],
                    minAmountsOut[2],
                    minAmountsOut[3]
                ],
                to
            );
            for (uint256 i = 0; i < nCoins; i++) amounts[i] = amountsOut[i];
        }
        if (toMode == LibTransfer.To.INTERNAL) {
            address factory = stable ? STABLE_FACTORY : CRYPTO_FACTORY;
            address[4] memory coins = ICurveFactory(factory).get_coins(pool);
            for (uint256 i = 0; i < nCoins; ++i) {
                if (amounts[i] > 0) {
                    msg.sender.increaseInternalBalance(
                        IERC20(coins[i]),
                        amounts[i]
                    );
                }
            }
        }
    }

    function removeLiquidityImbalance(
        address pool,
        uint256[] calldata amountsOut,
        uint256 maxAmountIn,
        bool stable,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        IERC20 token = tokenForPool(pool);
        maxAmountIn = token.receiveToken(maxAmountIn, msg.sender, fromMode);
        uint256 nCoins = amountsOut.length;
        address to = toMode == LibTransfer.To.EXTERNAL
            ? msg.sender
            : address(this);
        uint256 amountIn;
        if (nCoins == 2)
            amountIn = ICurvePool2R(pool).remove_liquidity_imbalance(
                [amountsOut[0], amountsOut[1]],
                maxAmountIn,
                to
            );
        else if (nCoins == 3)
            amountIn = ICurvePool3R(pool).remove_liquidity_imbalance(
                [amountsOut[0], amountsOut[1], amountsOut[2]],
                maxAmountIn,
                to
            );
        else
            amountIn = ICurvePool4R(pool).remove_liquidity_imbalance(
                [amountsOut[0], amountsOut[1], amountsOut[2], amountsOut[3]],
                maxAmountIn,
                to
            );
        if (amountIn < maxAmountIn) {
            LibTransfer.To refundMode = (
                fromMode == LibTransfer.From.EXTERNAL
                    ? LibTransfer.To.EXTERNAL
                    : LibTransfer.To.INTERNAL
            );
            token.sendToken(maxAmountIn - amountIn, msg.sender, refundMode);
        }
        if (toMode == LibTransfer.To.INTERNAL) {
            address factory = stable ? STABLE_FACTORY : CRYPTO_FACTORY;
            address[4] memory coins = ICurveFactory(factory).get_coins(pool);
            for (uint256 i = 0; i < nCoins; ++i) {
                if (amountsOut[i] > 0) {
                    msg.sender.increaseInternalBalance(
                        IERC20(coins[i]),
                        amountsOut[i]
                    );
                }
            }
        }
    }

    function removeLiquidityOneToken(
        address pool,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        bool stable,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        IERC20 fromToken = tokenForPool(pool);
        amountIn = fromToken.receiveToken(amountIn, msg.sender, fromMode);
        int128 i = getI(toToken, pool, stable);
        if (toMode == LibTransfer.To.EXTERNAL) {
            ICurvePoolR(pool).remove_liquidity_one_coin(
                amountIn,
                i,
                minAmountOut,
                msg.sender
            );
        } else {
            uint256 amountOut = ICurvePool(pool).remove_liquidity_one_coin(
                amountIn,
                i,
                minAmountOut
            );
            msg.sender.increaseInternalBalance(IERC20(toToken), amountOut);
        }
    }

    function getIandJ(
        address from,
        address to,
        address pool,
        bool stable
    ) private view returns (int128 i, int128 j) {
        address factory = stable ? STABLE_FACTORY : CRYPTO_FACTORY;
        address[4] memory coins = ICurveFactory(factory).get_coins(pool);
        i = 4;
        j = 4;
        for (uint256 _i = 0; _i < 4; ++_i) {
            if (coins[_i] == from) i = int128(_i);
            else if (coins[_i] == to) j = int128(_i);
            else if (coins[_i] == address(0)) break;
        }
        require(i < 4 && j < 4, "Curve: Tokens not in pool");
    }

    function getUnderlyingIandJ(
        address from,
        address to,
        address pool
    ) private view returns (int128 i, int128 j) {
        address[8] memory coins = ICurveFactory(STABLE_FACTORY)
            .get_underlying_coins(pool);
        i = 8;
        j = 8;
        for (uint256 _i = 0; _i < 8; ++_i) {
            if (coins[_i] == from) i = int128(_i);
            else if (coins[_i] == to) j = int128(_i);
            else if (coins[_i] == address(0)) break;
        }
        require(i < 8 && j < 8, "Curve: Tokens not in pool");
    }

    function getI(
        address token,
        address pool,
        bool stable
    ) private view returns (int128 i) {
        address factory = stable ? STABLE_FACTORY : CRYPTO_FACTORY;
        address[4] memory coins = ICurveFactory(factory).get_coins(pool);
        i = 4;
        for (uint256 _i = 0; _i < 4; ++_i) {
            if (coins[_i] == token) i = int128(_i);
            else if (coins[_i] == address(0)) break;
        }
        require(i < 4, "Curve: Tokens not in pool");
    }

    function tokenForPool(address pool) private pure returns (IERC20 token) {
        if (pool == C.curve3PoolAddress()) return C.threeCrv();
        if (pool == C.triCryptoPoolAddress()) return C.triCrypto();
        return IERC20(pool);
    }
}
