/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
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
    address private constant STABLE_REGISTRY = 0xB9fC157394Af804a3578134A6585C0dc9cc990d4;
    address private constant CURVE_REGISTRY = 0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5;
    address private constant CRYPTO_REGISTRY = 0x8F942C20D02bEfc377D41445793068908E2250D0;

    uint256 private constant MAX_COINS = 8;
    int128 private constant MAX_COINS_128 = 8;

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using LibBalance for address payable;
    using LibApprove for IERC20;

    function exchange(
        address pool,
        address registry,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        (int128 i, int128 j) = getIandJ(fromToken, toToken, pool, registry);
        amountIn = IERC20(fromToken).receiveToken(
            amountIn,
            msg.sender,
            fromMode
        );
        IERC20(fromToken).approveToken(pool, amountIn);

        if (toMode == LibTransfer.To.EXTERNAL && isStable(registry)) {
            ICurvePoolR(pool).exchange(i, j, amountIn, minAmountOut, msg.sender);
        } else {
            uint256 amountOut;
            if (hasNoReturnValue(pool)) {
                uint256 beforeBalance = IERC20(toToken).balanceOf(address(this));
                ICurvePoolNoReturn(pool).exchange(uint256(i), uint256(j), amountIn, minAmountOut);
                amountOut = IERC20(toToken).balanceOf(address(this)).sub(beforeBalance);
            } else {
                if (isStable(registry)) amountOut = ICurvePool(pool).exchange(i, j, amountIn, minAmountOut);
                else amountOut = ICurvePoolC(pool).exchange(uint256(i), uint256(j), amountIn, minAmountOut);
            }
            LibTransfer.sendToken(IERC20(toToken), amountOut, msg.sender, toMode);
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
        amountIn = IERC20(fromToken).receiveToken(amountIn, msg.sender, fromMode);
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
        address registry,
        uint256[] memory amounts,
        uint256 minAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        address[8] memory coins = getCoins(pool, registry);
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

        uint256 amountOut;
        if (hasNoReturnValue(pool)) {
            IERC20 lpToken = IERC20(tokenForPool(pool));
            uint256 beforeBalance = lpToken.balanceOf(address(this));
            ICurvePoolNoReturn(pool).add_liquidity(
                [amounts[0], amounts[1], amounts[2]],
                minAmountOut
            );
            amountOut = lpToken.balanceOf(address(this)).sub(beforeBalance);
            LibTransfer.sendToken(lpToken, amountOut, msg.sender, toMode);
            return;
        }
        address to = toMode == LibTransfer.To.EXTERNAL
            ? msg.sender
            : address(this);
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
            msg.sender.increaseInternalBalance(IERC20(pool), amountOut);
    }

    function removeLiquidity(
        address pool,
        address registry,
        uint256 amountIn,
        uint256[] calldata minAmountsOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        IERC20 token = tokenForPool(pool);
        amountIn = token.receiveToken(amountIn, msg.sender, fromMode);

        uint256 nCoins = minAmountsOut.length;

        // 3Pool and Tri-Crypto pools do not return the resulting value,
        // Thus, we need to call the balanceOf function to determine
        // how many tokens were received.
        if (hasNoReturnValue(pool)) {
            uint256 amountOut;
            address[8] memory coins = getCoins(pool, registry);
            uint256[] memory beforeAmounts = new uint256[](nCoins);
            for (uint256 i = 0; i < nCoins; ++i) beforeAmounts[i] = IERC20(coins[i]).balanceOf(address(this));
            ICurvePoolNoReturn(pool).remove_liquidity(
                amountIn,
                [minAmountsOut[0], minAmountsOut[1], minAmountsOut[2]]
            );
            for (uint256 i = 0; i < nCoins; ++i) {
                amountOut = IERC20(coins[i]).balanceOf(address(this)).sub(beforeAmounts[i]);
                if (amountOut > 0) LibTransfer.sendToken(IERC20(coins[i]), amountOut, msg.sender, toMode);
            }
            return;
        }

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
            address[8] memory coins = getCoins(pool, registry);
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
    address registry,
    uint256[] calldata amountsOut,
    uint256 maxAmountIn,
    LibTransfer.From fromMode,
    LibTransfer.To toMode
) external payable nonReentrant {
        IERC20 token = tokenForPool(pool);
        maxAmountIn = token.receiveToken(maxAmountIn, msg.sender, fromMode);
        uint256 nCoins = amountsOut.length;
        uint256 amountIn;

        // 3Pool and Tri-Crypto pools do not return the resulting value,
        // Thus, we need to call the balanceOf function to determine
        // how many tokens were received.
        if (hasNoReturnValue(pool)) {
            address[8] memory coins = getCoins(pool, registry);
            IERC20 lpToken = IERC20(tokenForPool(pool));
            uint256 beforeBalance = lpToken.balanceOf(address(this));
            ICurvePoolNoReturn(pool).remove_liquidity(
                maxAmountIn,
                [amountsOut[0], amountsOut[1], amountsOut[2]]
            );
            for (uint256 i = 0; i < nCoins; ++i) {
                if (amountsOut[i] > 0) {
                    LibTransfer.sendToken(IERC20(coins[i]), amountsOut[i], msg.sender, toMode);
                }
            }
            amountIn = lpToken.balanceOf(address(this)).sub(beforeBalance);
            refundUnusedLPTokens(token, maxAmountIn, amountIn, fromMode);
            return;
        }

        address to = toMode == LibTransfer.To.EXTERNAL
            ? msg.sender
            : address(this);
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
        refundUnusedLPTokens(token, maxAmountIn, amountIn, fromMode);
        if (toMode == LibTransfer.To.INTERNAL) {
            address[8] memory coins = getCoins(pool, registry);
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
        address registry,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        IERC20 fromToken = tokenForPool(pool);
        amountIn = fromToken.receiveToken(amountIn, msg.sender, fromMode);
        int128 i = getI(toToken, pool, registry);

        if (hasNoReturnValue(pool)) {
            uint256 beforeBalance = IERC20(toToken).balanceOf(address(this));
            ICurvePool(pool).remove_liquidity_one_coin(
                amountIn,
                i,
                minAmountOut
            );
            uint256 amountOut = IERC20(toToken).balanceOf(address(this)).sub(beforeBalance);
            LibTransfer.sendToken(IERC20(toToken), amountOut, msg.sender, toMode);
            return;
        }

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

    function getUnderlyingIandJ(
        address from,
        address to,
        address pool
    ) private view returns (int128 i, int128 j) {
        address[MAX_COINS] memory coins = ICurveFactory(STABLE_REGISTRY)
            .get_underlying_coins(pool);
        i = MAX_COINS_128;
        j = MAX_COINS_128;
        for (uint256 _i = 0; _i < MAX_COINS; ++_i) {
            if (coins[_i] == from) i = int128(_i);
            else if (coins[_i] == to) j = int128(_i);
            else if (coins[_i] == address(0)) break;
        }
        require(i < MAX_COINS_128 && j < MAX_COINS_128, "Curve: Tokens not in pool");
    }

    function getIandJ(
        address from,
        address to,
        address pool,
        address registry
    ) private view returns (int128 i, int128 j) {
        address[MAX_COINS] memory coins = getCoins(pool, registry);
        i = MAX_COINS_128;
        j = MAX_COINS_128;
        for (uint256 _i = 0; _i < MAX_COINS; ++_i) {
            if (coins[_i] == from) i = int128(_i);
            else if (coins[_i] == to) j = int128(_i);
            else if (coins[_i] == address(0)) break;
        }
        require(i < MAX_COINS_128 && j < MAX_COINS_128, "Curve: Tokens not in pool");
    }

    function getI(
        address token,
        address pool,
        address registry
    ) private view returns (int128 i) {
        address[MAX_COINS] memory coins = getCoins(pool, registry);
        i = MAX_COINS_128;
        for (uint256 _i = 0; _i < MAX_COINS; ++_i) {
            if (coins[_i] == token) i = int128(_i);
            else if (coins[_i] == address(0)) break;
        }
        require(i < MAX_COINS_128, "Curve: Tokens not in pool");
    }

    function tokenForPool(address pool) private pure returns (IERC20 token) {
        if (pool == C.curve3PoolAddress()) return C.threeCrv();
        if (pool == C.triCryptoPoolAddress()) return C.triCrypto();
        return IERC20(pool);
    }

    function getCoins(address pool, address registry)
        private
        view
        returns (address[8] memory)
    {
        if (registry == STABLE_REGISTRY) {
            address[4] memory coins =  ICurveFactory(registry).get_coins(pool);
            return [coins[0], coins[1], coins[2], coins[3], address(0), address(0), address(0), address(0)];
        }
        require(registry == CURVE_REGISTRY ||
                registry == CRYPTO_REGISTRY,
                "Curve: Not valid registry"
        );
        return ICurveCryptoFactory(registry)
            .get_coins(pool);
    }

    function isStable(address registry) private pure returns (bool) {
        return registry == STABLE_REGISTRY;
    }

    function hasNoReturnValue(address pool) private pure returns (bool) {
        return pool == C.triCryptoPoolAddress() || pool == C.curve3PoolAddress();
    }

    function refundUnusedLPTokens(IERC20 token, uint256 maxAmountIn, uint256 amountIn, LibTransfer.From fromMode) private {
        if (amountIn < maxAmountIn) {
            LibTransfer.To refundMode = (
                fromMode == LibTransfer.From.EXTERNAL
                    ? LibTransfer.To.EXTERNAL
                    : LibTransfer.To.INTERNAL
            );
            token.sendToken(maxAmountIn - amountIn, msg.sender, refundMode);
        }
    }
}
