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
    address payable private _weth;

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

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        MockToken(tokenA).transferFrom(msg.sender, address(this), amountA);
        MockToken(tokenB).transferFrom(msg.sender, address(this), amountB);
        liquidity = IUniswapV2Pair(_pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual returns (uint amountA, uint amountB) {
        IUniswapV2Pair(_pair).transferFrom(msg.sender, _pair, liquidity); // send liquidity to pair
        (uint amount0, uint amount1) = IUniswapV2Pair(_pair).burn(to);
        (amountA, amountB) = tokenA == IUniswapV2Pair(_pair).token0() ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
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
        require(amountOut >= amountOutMin, "MockUniV2Router: INSUFFICIENT_INPUT_AMOUNT.");
        MockToken(path[0]).burnFrom(msg.sender, amountIn);
        MockToken(path[1]).mint(msg.sender, amountOut);
        uint[] memory amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        return amounts;
    }

    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts)
    {
        require(path[0] == _weth, 'UniswapV2Router: INVALID_PATH');
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= msg.value, 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
        MockWETH(_weth).deposit{value: amounts[0]}();
        MockWETH(_weth).burn(amounts[0]);
        MockToken(path[1]).mint(to, amounts[1]);
        // refund dust eth, if any
        if (msg.value > amounts[0]){
             (bool success, ) = msg.sender.call{value: msg.value - amounts[0]}(new bytes(0));
             require(success, 'TransferHelper::safeTransferETH: ETH transfer failed');
        }
    }

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts)
    {
        require(path[0] == _weth, 'UniswapV2Router: INVALID_PATH');
        uint256 amountOut = getAmountOut(msg.value, path);
        amounts = new uint[](2);
        amounts[0] = msg.value;
        amounts[1] = amountOut;
        require(amounts[1] >= amountOutMin, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
        MockWETH(_weth).deposit{value: amounts[0]}();
        MockWETH(_weth).burn(amounts[0]);
        MockToken(path[1]).mint(msg.sender, amounts[1]);
        
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
        uint numerator = amountIn.mul(reserveOut);
        uint denominator = reserveIn.add(amountIn);
        amountOut = numerator / denominator;
    }

    function getReserves(address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (uint reserve0, uint reserve1,) = IUniswapV2Pair(_pair).getReserves();
        (reserveA, reserveB) = tokenA == IUniswapV2Pair(_pair).token0() ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal view returns (uint amountIn) {
        require(amountOut > 0, 'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn.mul(amountOut);
        uint denominator = reserveOut.sub(amountOut);
        amountIn = (numerator / denominator).add(1);
    }

    function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts) {
        require(path.length == 2, 'UniswapV2Library: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[1] = amountOut;
        (uint reserveIn, uint reserveOut) = getReserves(path[0], path[1]);
        amounts[0] = getAmountIn(amounts[1], reserveIn, reserveOut);
    }

    

    function pair() public view returns (address) {
        return _pair;
}

    function setPair(address ppair) public {
        _pair = ppair;
        MockUniswapV2Pair(_pair).setToken2(_weth);
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
