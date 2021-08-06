/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./MockUniswapV2Pair.sol";
import "./MockWETH.sol";

/**
 * @author Publius
 * @title Mock Uniswap V2 Router
**/
contract MockUniswapV2Router {
    using SafeMath for uint256;
    address private _pair;
    address private _weth;

    constructor() {
        _weth = address(new MockWETH());
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            _weth,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        MockToken(token).transferFrom(msg.sender, address(this), amountToken);
        liquidity = MockUniswapV2Pair(_pair).mint(to);
        if (msg.value > amountETH) {
            (bool success,) = msg.sender.call{ value: msg.value.sub(amountETH) }("");
            require(success, "MockUniV2Router: Refund failed.");
        }
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    )
        internal
        virtual
        returns (uint amountA, uint amountB)
    {
        (uint reserve0, uint reserve1,) = IUniswapV2Pair(_pair).getReserves();
        (uint reserveA, uint reserveB) = tokenA == IUniswapV2Pair(_pair).token0() ?
            (reserve0, reserve1) :
            (reserve1, reserve0);
        if (reserveA == 0 && reserveB == 0) {
                (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired && amountBOptimal > 0) {
                require(amountBOptimal >= amountBMin, "MockUniV2Router: INSUFFICIENT_B_AMOUNT.");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired, "MockUniV2Router: INSUFFICIENT_A_AMOUNT.");
                require(amountAOptimal >= amountAMin, "MockUniV2Router: INSUFFICIENT_A_AMOUNT.");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        returns (uint[] memory)
    {
        uint amountOut = getAmountOut(amountIn, path);
        require(amountOut > amountOutMin, "MockUniV2Router: INSUFFICIENT_INPUT_AMOUNT.");
        MockToken(path[0]).transferFrom(msg.sender, address(this), amountIn);
        MockToken(path[1]).mint(msg.sender, amountOut);
        uint[] memory amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        return amounts;
    }

    function getAmountOut(uint amountIn, address[] calldata path)
        internal
        view
        returns (uint amountOut)
    {
        (uint reserve0, uint reserve1,) = IUniswapV2Pair(_pair).getReserves();
        (uint reserveIn, uint reserveOut) = path[0] == IUniswapV2Pair(_pair).token0() ?
            (reserve0, reserve1) :
            (reserve1, reserve0);
        require(amountIn > 0, "MockUniV2Router: INSUFFICIENT_INPUT_AMOUNT.");
        require(reserveIn > 0 && reserveOut > 0, "MockUniV2Router: INSUFFICIENT_LIQUIDITY.");
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    function pair() public view returns (address) {
        return _pair;
    }

    function setPair(address ppair) public {
        _pair = ppair;
    }

    function WETH() public view returns (address){
        return _weth;
    }

    function quote(uint amountA, uint reserveA, uint reserveB)
        internal
        pure
        returns (uint amountB)
    {
        require(amountA > 0, "MockUniV2Router: INSUFFICIENT_AMOUNT.");
        require(reserveA > 0 && reserveB > 0, "MockUniV2Router: INSUFFICIENT_LIQUIDITY.");
        amountB = amountA.mul(reserveB) / reserveA;
    }

}
