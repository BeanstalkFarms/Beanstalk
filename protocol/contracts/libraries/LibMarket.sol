/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";

/**
 * @author Publius
 * @title Market Library handles swapping, addinga and removing LP on Uniswap for Beanstalk.
**/
library LibMarket {

    struct DiamondStorage {
        address bean;
        address weth;
        address router;
    }

    struct AddLiquidity {
        uint256 beanAmount;
        uint256 minBeanAmount;
        uint256 minEthAmount;
    }

    using SafeMath for uint256;

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

    /**
     * Swap
    **/

    function buy(uint256 buyBeanAmount) internal returns (uint256 amount) {
        (uint256 ethAmount, uint256 beanAmount) = _buy(buyBeanAmount, msg.value, msg.sender);
        (bool success,) = msg.sender.call{ value: msg.value.sub(ethAmount) }("");
        require(success, "Market: Refund failed.");
        return beanAmount;
    }

    function buyAndDeposit(uint256 buyBeanAmount) internal returns (uint256 amount) {
        (uint256 ethAmount, uint256 beanAmount) = _buy(buyBeanAmount, msg.value, address(this));
        (bool success,) = msg.sender.call{ value: msg.value.sub(ethAmount) }("");
        require(success, "Market: Refund failed.");
        return beanAmount;
    }

    function sellToWETH(uint256 sellBeanAmount, uint256 minBuyEthAmount)
        internal
        returns (uint256 amount)
    {
        (,uint256 outAmount) = _sell(sellBeanAmount, minBuyEthAmount, address(this));
        return outAmount;
    }

    /**
     *  Liquidity
    **/

    function addLiquidity(AddLiquidity calldata al) internal returns (uint256, uint256) {
        (uint256 beansDeposited, uint256 ethDeposited, uint256 liquidity) = _addLiquidity(
            msg.value,
            al.beanAmount,
            al.minEthAmount,
            al.minBeanAmount
        );
        (bool success,) = msg.sender.call{ value: msg.value.sub(ethDeposited) }("");
        require(success, "Market: Refund failed.");
        return (beansDeposited, liquidity);
    }

    function removeLiquidity(uint256 liqudity, uint256 minBeanAmount,uint256 minEthAmount)
        internal
        returns (uint256 beanAmount, uint256 ethAmount)
    {
        DiamondStorage storage ds = diamondStorage();
        return IUniswapV2Router02(ds.router).removeLiquidityETH(
            ds.bean,
            liqudity,
            minBeanAmount,
            minEthAmount,
            msg.sender,
            block.timestamp.add(1));
    }

    function addAndDepositLiquidity(AddLiquidity calldata al) internal returns (uint256) {
        DiamondStorage storage ds = diamondStorage();
        IBean(ds.bean).transferFrom(msg.sender, address(this), al.beanAmount);
        (uint256 beans, uint256 liquidity) = addLiquidity(al);
        if (al.beanAmount > beans) IBean(ds.bean).transfer(msg.sender, al.beanAmount.sub(beans));
        return liquidity;
    }

    function swapAndAddLiquidity(
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        internal
        returns (uint256)
    {
        uint256 boughtLP;
        if (buyBeanAmount > 0)
            boughtLP = LibMarket.buyBeansAndAddLiquidity(buyBeanAmount, al);
        else if (buyEthAmount > 0)
            boughtLP = LibMarket.buyEthAndAddLiquidity(buyEthAmount, al);
        else
            boughtLP = LibMarket.addAndDepositLiquidity(al);
        return boughtLP;
    }


    function buyBeansAndAddLiquidity(uint256 buyBeanAmount, AddLiquidity calldata al)
        internal
        returns (uint256)
    {
        DiamondStorage storage ds = diamondStorage();
        address[] memory path = new address[](2);
        path[0] = ds.weth;
        path[1] = ds.bean;
        uint256[] memory amounts = IUniswapV2Router02(ds.router).getAmountsIn(buyBeanAmount, path);
        (uint256 ethSold, uint256 beans) = _buy(buyBeanAmount, amounts[0], address(this));
        if (al.beanAmount > buyBeanAmount) {
            IBean(ds.bean).transferFrom(msg.sender, address(this), al.beanAmount.sub(buyBeanAmount));
            beans = beans.add(al.beanAmount.sub(buyBeanAmount));
        }
        uint256 liquidity; uint256 ethAdded;
        (beans, ethAdded, liquidity) = _addLiquidity(
            msg.value.sub(ethSold),
            beans,
            al.minEthAmount,
            al.minBeanAmount
        );
        if (al.beanAmount > beans) IBean(ds.bean).transfer(msg.sender, al.beanAmount.sub(beans));
        if (msg.value > ethAdded.add(ethSold)) {
            (bool success,) = msg.sender.call{ value: msg.value.sub(ethAdded).sub(ethSold) }("");
            require(success, "Market: Refund failed.");
        }
        return liquidity;
    }

    function buyEthAndAddLiquidity(uint256 buyWethAmount, AddLiquidity calldata al)
        internal
        returns (uint256)
    {
        DiamondStorage storage ds = diamondStorage();
        uint256 sellBeans = _amountIn(buyWethAmount);
        IBean(ds.bean).transferFrom(msg.sender, address(this), al.beanAmount.add(sellBeans));
        (uint256 beansSold, uint256 wethBought) = _sell(sellBeans, buyWethAmount, address(this));
        if (msg.value > 0) IWETH(ds.weth).deposit{value: msg.value}();
        (uint256 beans, uint256 ethAdded, uint256 liquidity) = _addLiquidityWETH(
            msg.value.add(wethBought),
            al.beanAmount,
            al.minEthAmount,
            al.minBeanAmount
        );

        if (al.beanAmount.add(sellBeans) > beans.add(beansSold))
            IBean(ds.bean).transfer(
                msg.sender,
                al.beanAmount.add(sellBeans).sub(beans.add(beansSold))
            );

        if (ethAdded < wethBought.add(msg.value)) {
            uint256 eth = wethBought.add(msg.value).sub(ethAdded);
            IWETH(ds.weth).withdraw(eth);
            (bool success, ) = msg.sender.call{value: eth}("");
            require(success, "Market: Ether transfer failed.");
        }
        return liquidity;
    }

    /**
     *  Shed
    **/

    function _sell(uint256 sellBeanAmount, uint256 minBuyEthAmount, address to)
        private
        returns (uint256 inAmount, uint256 outAmount)
    {
        DiamondStorage storage ds = diamondStorage();
        address[] memory path = new address[](2);
        path[0] = ds.bean;
        path[1] = ds.weth;
        uint[] memory amounts = IUniswapV2Router02(ds.router).swapExactTokensForTokens(
            sellBeanAmount,
            minBuyEthAmount,
            path,
            to,
            block.timestamp.add(1)
        );
        return (amounts[0], amounts[1]);
    }

    function _buy(uint256 beanAmount, uint256 ethAmount, address to)
        private
        returns (uint256 inAmount, uint256 outAmount)
    {
        DiamondStorage storage ds = diamondStorage();
        address[] memory path = new address[](2);
        path[0] = ds.weth;
        path[1] = ds.bean;

        uint[] memory amounts = IUniswapV2Router02(ds.router).swapExactETHForTokens{value: ethAmount}(
            beanAmount,
            path,
            to,
            block.timestamp.add(1)
        );
        return (amounts[0], amounts[1]);
    }

    function _addLiquidity(uint256 ethAmount, uint256 beanAmount, uint256 minEthAmount, uint256 minBeanAmount)
        private
        returns (uint256, uint256, uint256)
    {
        DiamondStorage storage ds = diamondStorage();
        return IUniswapV2Router02(ds.router).addLiquidityETH{value: ethAmount}(
            ds.bean,
            beanAmount,
            minBeanAmount,
            minEthAmount,
            address(this),
            block.timestamp.add(1));
    }

    function _addLiquidityWETH(uint256 wethAmount, uint256 beanAmount, uint256 minWethAmount, uint256 minBeanAmount)
        private
        returns (uint256, uint256, uint256)
    {
        DiamondStorage storage ds = diamondStorage();
        return IUniswapV2Router02(ds.router).addLiquidity(
            ds.bean,
            ds.weth,
            beanAmount,
            wethAmount,
            minBeanAmount,
            minWethAmount,
            address(this),
            block.timestamp.add(1));
    }

    function _amountIn(uint256 buyWethAmount) private view returns (uint256) {
        DiamondStorage storage ds = diamondStorage();
        address[] memory path = new address[](2);
        path[0] = ds.bean;
        path[1] = ds.weth;
        uint256[] memory amounts = IUniswapV2Router02(ds.router).getAmountsIn(buyWethAmount, path);
        return amounts[0];
    }

}
