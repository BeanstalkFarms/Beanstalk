/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './LibAppStorage.sol';
import '../farm/AppStorage.sol';
import './LibUserBalance.sol';
import "../interfaces/IWETH.sol";

library LibUniswap {

    using SafeMath for uint;

    address private constant uniswapFactory = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'LibUniswap: EXPIRED');
        _;
    }

    struct DiamondStorage {
        address bean;
        address weth;
        address router;
    }

    struct SwapInfo {
	    address tokenA;
	    address tokenB;
	    address pair;
	    uint value;
    }
    struct SwapState {
	    address recipient;
	    address[] path;
	    uint256 snapshot;
    }

    struct AddLiquidity {
        uint256 beanAmount;
        uint256 minBeanAmount;
        uint256 minEthAmount;
    }

    struct Swap {
	uint256 beans;
	uint256 sellBeans;
	uint256 ethAdded;
	uint256 liquidity;
	uint256 returnETH;
	address[] path;
	uint256[] amounts;
    }

    bytes32 private constant MARKET_STORAGE_POSITION = keccak256("diamond.standard.market.storage");

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = MARKET_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function initMarket(address bean, address weth, address router) internal {
        DiamondStorage storage ds = diamondStorage();
        ds.bean = bean;
        ds.weth = weth;
        ds.router = router;
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal returns (uint amountA, uint amountB) {
        // create the pair if it doesn't exist yet
	AppStorage storage s = LibAppStorage.diamondStorage();
        if (IUniswapV2Factory(uniswapFactory).getPair(tokenA, tokenB) == address(0)) {
            IUniswapV2Factory(uniswapFactory).createPair(tokenA, tokenB);
        }
        (uint reserveA, uint reserveB) = getReserves(uniswapFactory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        }
	else {
            uint amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'LibUniswap: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'LibUniswap: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    // If we want to add liquidity from an internal convert, i.e. from Convert Facet, which converts siloed beans to LP, the bool will be true. Otherwise, liquidity will be provided by the user, not by Beanstalk.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
	bool convert
    ) internal ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
	AppStorage storage s = LibAppStorage.diamondStorage();	
	SwapInfo memory swap;
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
	swap.tokenA = tokenA;
	swap.tokenB = tokenB;
	swap.pair = pairFor(uniswapFactory, swap.tokenA, swap.tokenB);
	if (!convert) {
        	TransferHelper.safeTransferFrom(swap.tokenA, msg.sender, swap.pair, amountA);
        	TransferHelper.safeTransferFrom(swap.tokenB, msg.sender, swap.pair, amountB);
	}
	else {
		IERC20(swap.tokenA).transfer(swap.pair, amountA); 
		IERC20(swap.tokenB).transfer(swap.pair, amountB);
	}
        liquidity = IUniswapV2Pair(swap.pair).mint(to);
    }
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) internal ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        (amountToken, amountETH) = _addLiquidity(
            token,
            s.c.weth,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pair = pairFor(uniswapFactory, token, s.c.weth);
	IERC20(token).transfer(pair, amountToken);
        //TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH(s.c.weth).deposit{value: amountETH}();
        assert(IWETH(s.c.weth).transfer(pair, amountETH));
        liquidity = IUniswapV2Pair(pair).mint(to);
        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
	bool convert // Once again, convert is only true when it is accessed from ConvertFacet
    ) internal ensure(deadline) returns (uint amountA, uint amountB) {
	SwapInfo memory swap;
	swap.tokenA = tokenA;
	swap.tokenB = tokenB;
	AppStorage storage s = LibAppStorage.diamondStorage();
        address pair = pairFor(uniswapFactory, swap.tokenA, swap.tokenB);
	if (!convert) {
        	IUniswapV2Pair(pair).transferFrom(msg.sender, pair, liquidity);	// send liquidity to pair
	}
	else {
		IUniswapV2Pair(pair).transfer(pair, liquidity); // send liquidity to pair
	}
        (uint amount0, uint amount1) = IUniswapV2Pair(pair).burn(to);
        (address token0,) = sortTokens(swap.tokenA, swap.tokenB);
        (amountA, amountB) = swap.tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'LibUniswap: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'LibUniswap: INSUFFICIENT_B_AMOUNT');
    }
    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) internal ensure(deadline) returns (uint amountToken, uint amountETH) {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        (amountToken, amountETH) = removeLiquidity(
            token,
            s.c.weth,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline,
	    false
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWETH(s.c.weth).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to, bool toInternalBalance) internal {
	AppStorage storage s = LibAppStorage.diamondStorage();
	SwapState memory swap;
	swap.recipient = _to;
	swap.path = path;
        for (uint i; i < swap.path.length - 1; i++) {
            (address input, address output) = (swap.path[i], swap.path[i + 1]);
            (address token0,) = sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));

	    if (i < swap.path.length - 2) {
		    address to = pairFor(uniswapFactory, output, swap.path[i + 2]);
	    	    IUniswapV2Pair(pairFor(uniswapFactory, input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
	    }
	    else {
		    swap.snapshot = IERC20(swap.path[swap.path.length - 1]).balanceOf(_to);
		    if (toInternalBalance) {
			    IUniswapV2Pair(pairFor(uniswapFactory, input, output)).swap(amount0Out, amount1Out, address(this), new bytes(0));
			    uint256 increment = IERC20(swap.path[swap.path.length - 1]).balanceOf(swap.recipient).sub(amount0Out) == swap.snapshot ? amount0Out : amount1Out;
			    LibUserBalance._increaseInternalBalance(swap.recipient, IERC20(swap.path[swap.path.length - 1]), increment);
		    }
		    else {
            	    	    IUniswapV2Pair(pairFor(uniswapFactory, input, output)).swap(amount0Out, amount1Out, swap.recipient, new bytes(0));
		    }
	    }
        }
    }
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] memory path,
        address to,
        uint deadline,
	Storage.Settings memory set,
	bool convert // This is to differentiate between normal swaps and swaps called from ConvertFacet
    ) internal ensure(deadline) returns (uint[] memory amounts) {
	AppStorage storage s = LibAppStorage.diamondStorage();
	amounts = getAmountsOut(uniswapFactory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'LibUniswap: INSUFFICIENT_OUTPUT_AMOUNT');
	if (!convert) {
		if (set.fromInternalBalance) {
			uint256 fromBeanstalk = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(path[0]), amounts[0], true);
			IERC20(path[0]).transfer(pairFor(uniswapFactory, path[0], path[1]), fromBeanstalk);
			TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0].sub(fromBeanstalk));
		}
		else {
        		TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0]);
		}
	}
	else {
		IERC20(path[0]).transfer(pairFor(uniswapFactory, path[0], path[1]), amounts[0]);
	}
        _swap(amounts, path, to, set.toInternalBalance);
    }
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] memory path,
        address to,
        uint deadline,
	Storage.Settings calldata set
    ) internal ensure(deadline) returns (uint[] memory amounts) {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        amounts = getAmountsIn(uniswapFactory, amountOut, path);
        require(amounts[0] <= amountInMax, 'LibUniswap: EXCESSIVE_INPUT_AMOUNT');
	if (set.fromInternalBalance) {
		uint256 fromBeanstalk = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(path[0]), amounts[0], true);
                IERC20(path[0]).transfer(pairFor(uniswapFactory, path[0], path[1]), fromBeanstalk);
                TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0].sub(fromBeanstalk));
	}
	else {
        	TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0]);
	}
        _swap(amounts, path, to, set.toInternalBalance);
    }
    
    function swapExactETHForTokens(uint amountOutMin, address[] memory path, address to, uint deadline, Storage.Settings calldata set)
        internal
        ensure(deadline)
        returns (uint[] memory amounts)
    {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        require(path[0] == s.c.weth, 'LibUniswap: INVALID_PATH');
        amounts = getAmountsOut(uniswapFactory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'LibUniswap: INSUFFICIENT_OUTPUT_AMOUNT');
        IWETH(s.c.weth).deposit{value: amounts[0]}();
        assert(IWETH(s.c.weth).transfer(pairFor(uniswapFactory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to, set.toInternalBalance);
    }
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] memory path, address to, uint deadline, Storage.Settings calldata set)
        internal
        ensure(deadline)
        returns (uint[] memory amounts)
    {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        require(path[path.length - 1] == s.c.weth, 'LibUniswap: INVALID_PATH');
        amounts = getAmountsIn(uniswapFactory, amountOut, path);
        require(amounts[0] <= amountInMax, 'LibUniswap: EXCESSIVE_INPUT_AMOUNT');
	if (set.fromInternalBalance) {
		uint256 fromBeanstalk = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(path[0]), amounts[0], true);
                IERC20(path[0]).transfer(pairFor(uniswapFactory, path[0], path[1]), fromBeanstalk);
                TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0].sub(fromBeanstalk));
	}
	else {
        	TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0]);
	}
        _swap(amounts, path, address(this), false);
        IWETH(s.c.weth).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] memory path, address to, uint deadline, Storage.Settings calldata set)
        internal
        ensure(deadline)
        returns (uint[] memory amounts)
    {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        require(path[path.length - 1] == s.c.weth, 'LibUniswap: INVALID_PATH');
        amounts = getAmountsOut(uniswapFactory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'LibUniswap: INSUFFICIENT_OUTPUT_AMOUNT');
	if (set.fromInternalBalance) {
		uint256 fromBeanstalk = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(path[0]), amounts[0], true);
                IERC20(path[0]).transfer(pairFor(uniswapFactory, path[0], path[1]), fromBeanstalk);
                TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0].sub(fromBeanstalk));
        }
	else {
        	TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(uniswapFactory, path[0], path[1]), amounts[0]);
	}
        _swap(amounts, path, address(this), false);
        IWETH(s.c.weth).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }
    function swapETHForExactTokens(uint amountOut, address[] memory path, address to, uint deadline)
        internal
        ensure(deadline)
        returns (uint[] memory amounts)
    {
	AppStorage storage s = LibAppStorage.diamondStorage();	
        require(path[0] == s.c.weth, 'LibUniswap: INVALID_PATH');
        amounts = getAmountsIn(uniswapFactory, amountOut, path);
        require(amounts[0] <= msg.value, 'LibUniswap: EXCESSIVE_INPUT_AMOUNT');
        IWETH(s.c.weth).deposit{value: amounts[0]}();
        assert(IWETH(s.c.weth).transfer(pairFor(uniswapFactory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to, false);
        // refund dust eth, if any
        if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    }

    /** 
    * Uniswap Library
    **/
   
   // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'LibUniswap: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'LibUniswap: ZERO_ADDRESS');
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address factory, address tokenA, address tokenB) internal view returns (address pair) {
	AppStorage storage s = LibAppStorage.diamondStorage();
        (address token0, address token1) = sortTokens(tokenA, tokenB);
	// Under Construction
         /* pair = address(uint(keccak256(abi.encodePacked(
                hex'ff',?
                factory,
                keccak256(abi.encodePacked(token0, token1)),
                hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
            //))));
	   */
	  pair = s.c.pair;
    }

    // fetches and sorts the reserves for a pair
    function getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1,) = IUniswapV2Pair(pairFor(factory, tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(uint amountA, uint reserveA, uint reserveB) internal view returns (uint amountB) {
        require(amountA > 0, 'LibUniswap: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'LibUniswap: INSUFFICIENT_LIQUIDITY');
        amountB = amountA.mul(reserveB) / reserveA;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal view returns (uint amountOut) {
        require(amountIn > 0, 'LibUniswap: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'LibUniswap: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
        require(amountOut > 0, 'LibUniswap: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'LibUniswap: INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn.mul(amountOut).mul(1000);
        uint denominator = reserveOut.sub(amountOut).mul(997);
        amountIn = (numerator / denominator).add(1);
    }

    // performs chained getAmountOut calculations on any number of pairs
    function getAmountsOut(address factory, uint amountIn, address[] memory path) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'LibUniswap: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut) = getReserves(factory, path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // performs chained getAmountIn calculations on any number of pairs
    function getAmountsIn(address factory, uint amountOut, address[] memory path) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'LibUniswap: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint i = path.length - 1; i > 0; i--) {
            (uint reserveIn, uint reserveOut) = getReserves(factory, path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    /*
     * LibMarket Auxiliary Functions
    */

    function swapAndAddLiquidity(
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        AddLiquidity calldata al,
	Storage.Settings calldata set
    )
        internal
        returns (uint256)
    {
        uint256 boughtLP;
        if (buyBeanAmount > 0) boughtLP = buyBeansAndAddLiquidity(buyBeanAmount, al, set);
        else if (buyEthAmount > 0) boughtLP = buyEthAndAddLiquidity(buyEthAmount, al, set);
        else boughtLP = addAndDepositLiquidity(al);
        return boughtLP;
    }

    function buyBeansAndAddLiquidity(uint256 buyBeanAmount, AddLiquidity calldata al, Storage.Settings calldata set)
        internal
        returns (uint256)
    {
	Swap memory swap;
	AppStorage storage s = LibAppStorage.diamondStorage();
        IWETH(s.c.weth).deposit{value: msg.value}();
	swap.path = new address[](2);
        swap.path[0] = s.c.weth;
        swap.path[1] = s.c.bean;
        swap.sellBeans = getAmountsIn(uniswapFactory, buyBeanAmount, swap.path)[0];
	swap.amounts = swapExactTokensForTokens(swap.sellBeans, buyBeanAmount, swap.path, address(this), block.timestamp.add(1), set, true);
	swap.beans = swap.amounts[1];
        // If beans bought does not cover the amount of money to move to LP
	if (al.beanAmount > buyBeanAmount) {
            LibUserBalance.allocatedBeans(al.beanAmount.sub(buyBeanAmount));
            swap.beans = swap.beans.add(al.beanAmount.sub(buyBeanAmount));
        }
	(swap.beans, swap.ethAdded, swap.liquidity) = addLiquidity(s.c.bean, s.c.weth, swap.beans, msg.value.sub(swap.amounts[0]), al.minBeanAmount, al.minEthAmount, address(this), block.timestamp.add(1), true);
        if (al.beanAmount > swap.beans) IBean(s.c.bean).transfer(msg.sender, al.beanAmount.sub(swap.beans));
        if (msg.value > swap.ethAdded.add(swap.amounts[0])) {
            swap.returnETH = msg.value.sub(swap.ethAdded).sub(swap.amounts[0]);
            IWETH(s.c.weth).withdraw(swap.returnETH);
            (bool success,) = msg.sender.call{ value: swap.returnETH }("");
            require(success, "Market: Refund failed.");
        }
        return swap.liquidity;
    }

    function buyEthAndAddLiquidity(uint256 buyWethAmount, AddLiquidity calldata al, Storage.Settings calldata set)
        internal
        returns (uint256)
    {
	Swap memory swap;
        AppStorage storage s = LibAppStorage.diamondStorage();
	swap.path = new address[](2);
	swap.path[0] = s.c.bean;
	swap.path[1] = s.c.weth;
        swap.sellBeans = getAmountsIn(uniswapFactory, buyWethAmount, swap.path)[0];
        LibUserBalance.allocatedBeans(al.beanAmount.add(swap.sellBeans));
	swap.amounts = swapExactTokensForTokens(swap.sellBeans, buyWethAmount, swap.path, address(this), block.timestamp.add(1), set, true);
        if (msg.value > 0) IWETH(s.c.weth).deposit{value: msg.value}();
	(swap.beans, swap.ethAdded, swap.liquidity) = addLiquidity(s.c.bean, s.c.weth, al.beanAmount, msg.value.add(swap.amounts[1]), al.minBeanAmount, al.minEthAmount, address(this), block.timestamp.add(1), true);

        if (al.beanAmount.add(swap.sellBeans) > swap.beans.add(swap.amounts[0])) {
        uint256 toTransfer = al.beanAmount.add(swap.sellBeans).sub(swap.beans.add(swap.amounts[0]));
	    IBean(s.c.bean).transfer(
            msg.sender,
            toTransfer
        );
	}

        if (swap.ethAdded < msg.value.add(swap.amounts[1])) {
            uint256 eth = swap.amounts[1].add(msg.value).sub(swap.ethAdded);
            IWETH(s.c.weth).withdraw(eth);
            (bool success, ) = msg.sender.call{value: eth}("");
            require(success, "Market: Ether transfer failed.");
        }
        return swap.liquidity;
    }

    function addAndDepositLiquidity(AddLiquidity calldata al) internal returns (uint256) {
	AppStorage storage s = LibAppStorage.diamondStorage();
	LibUserBalance.allocatedBeans(al.beanAmount);
        (uint256 beansDeposited, uint256 ethDeposited, uint256 liquidity) = addLiquidityETH(s.c.bean, al.beanAmount, al.minBeanAmount, al.minEthAmount, address(this), block.timestamp.add(1)); //{value: msg.value}
        (bool success,) = msg.sender.call{ value: msg.value.sub(ethDeposited) }("");
        require(success, "Market: Refund failed.");
        if (al.beanAmount > beansDeposited) IBean(s.c.bean).transfer(msg.sender, al.beanAmount.sub(beansDeposited));
        return liquidity;
    }

    function buyExactTokensToWallet(uint256 buyBeanAmount, address to, bool toWallet) internal returns (uint256 amount) {
	AppStorage storage s = LibAppStorage.diamondStorage();
        if (toWallet) amount = buyExactTokens(buyBeanAmount, to);
        else {
            amount = buyExactTokens(buyBeanAmount, address(this));
	    LibUserBalance._increaseInternalBalance(to, IBean(s.c.bean), amount);
        }
    }

    function buyExactTokens(uint256 buyBeanAmount, address to) internal returns (uint256 amount) {
        (uint256 ethAmount, uint256 beanAmount) = _buyExactTokens(buyBeanAmount, msg.value, to);
        (bool success,) = msg.sender.call{ value: msg.value.sub(ethAmount) }("");
        require(success, "Market: Refund failed.");
        return beanAmount;
    }

    function _buyExactTokens(uint256 beanAmount, uint256 ethAmount, address to)
        private
        returns (uint256 inAmount, uint256 outAmount)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory path = new address[](2);
        path[0] = s.c.weth;
        path[1] = s.c.bean;

        uint[] memory amounts = swapETHForExactTokens(
            beanAmount,
            path,
            to,
            block.timestamp.add(1)
        );
        return (amounts[0], amounts[1]);
    }
}
