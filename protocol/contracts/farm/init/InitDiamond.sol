/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {IERC165} from "../../interfaces/IERC165.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "../../interfaces/IDiamondLoupe.sol";
import {IERC173} from "../../interfaces/IERC173.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "../../C.sol";
import "../../interfaces/IBean.sol";
import "../../interfaces/IWETH.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../../Bean.sol";
import "../../mocks/MockToken.sol";
import '../../libraries/LibUniswap.sol';

//import '../../libraries/LibMarket.sol';
/**
 * @author Publius
 * @title Init Diamond initializes the Beanstalk Diamond.
**/
contract InitDiamond {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    address private constant UNISWAP_FACTORY = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    address private constant UNISWAP_ROUTER = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address private constant PEG_PAIR = address(0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc);
    address private constant BEAN_LUSD = address(0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D);
    address private constant LUSD = address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0);
    address private constant THREE_CURVE = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    address private constant BEAN_3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);

    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;

        s.c.bean = address(new Bean());
        s.c.weth = IUniswapV2Router02(UNISWAP_ROUTER).WETH();
        s.c.pair = address(IUniswapV2Factory(UNISWAP_FACTORY).createPair(s.c.bean, s.c.weth));
        s.c.pegPair = PEG_PAIR;

        IBean(s.c.bean).approve(UNISWAP_ROUTER, uint256(-1));
        IUniswapV2Pair(s.c.pair).approve(UNISWAP_ROUTER, uint256(-1));
        IWETH(s.c.weth).approve(UNISWAP_ROUTER, uint256(-1));
        IBean(s.c.bean).approve(BEAN_LUSD, uint256(-1));
        IBean(s.c.bean).approve(BEAN_3CRV, uint256(-1));
        IERC20(LUSD).approve(BEAN_LUSD, uint256(-1));
        IERC20(THREE_CURVE).approve(BEAN_3CRV, uint256(-1));

        s.cases = [int8(3),1,0,0,-1,-3,-3,0,3,1,0,0,-1,-3,-3,0,3,3,1,0,0,0,-1,0,3,3,1,0,1,0,-1,0];
        s.w.yield = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.period = C.getSeasonPeriod();
        s.season.timestamp = block.timestamp;
        s.season.start = s.season.period > 0 ?
            (block.timestamp / s.season.period) * s.season.period :
            block.timestamp;

        s.index = (IUniswapV2Pair(s.c.pair).token0() == s.c.bean) ? 0 : 1;
        LibUniswap.initMarket(s.c.bean, s.c.weth, UNISWAP_ROUTER);

        IBean(s.c.bean).mint(msg.sender, C.getAdvanceIncentive());
        emit Incentivization(msg.sender, C.getAdvanceIncentive());
        s.remainingEth = 1;
    }

}
