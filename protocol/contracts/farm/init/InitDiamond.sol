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
import {LibMarket} from "../../libraries/LibMarket.sol";
import {LibStalk} from "../../libraries/LibStalk.sol";
import "../../C.sol";
import "../../interfaces/IBean.sol";
import "../../interfaces/IWETH.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../../Bean.sol";
import "../../mocks/MockToken.sol";
import "../../Seed.sol";
import "../../interfaces/ISeed.sol";
import "../../interfaces/IWeightedPoolFactory.sol";

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
    address private constant BALANCER_WEIGHTED_POOL_FACTORY = address(0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9);
    address private constant BALANCER_VAULT = address(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

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
        LibMarket.initMarket(s.c.bean, s.c.weth, UNISWAP_ROUTER);
        LibStalk.initStalkToken('Stalk', 'STALK');

        IBean(s.c.bean).mint(msg.sender, C.getAdvanceIncentive());
        emit Incentivization(msg.sender, C.getAdvanceIncentive());
        s.ss[s.c.pair].selector = bytes4(keccak256("uniswapLPtoBDV(address,uint256)"));
        s.ss[s.c.pair].seeds = 4;
        s.ss[s.c.pair].stalk = 10000;

        // Balancer Stalk, Seed, Bean Pool Creation
        bytes memory bytecode = type(Seed).creationCode;
        // Generate Salt using Owner of Seed Contract
        bytes32 salt = keccak256(abi.encodePacked(address(this)));
        address seedAddress;
        assembly {
            seedAddress := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        s.seedContract = seedAddress;

        s.balancerVault = BALANCER_VAULT;
        // Balancer Pool Parameters
        string memory name = "Three-Token Bean, Stalk, Seeds Test Pool";
        string memory symbol = "33SEED-33STALK-34Bean";
        IERC20[] memory tokens;
        tokens[0] = IERC20(seedAddress);
        tokens[1] = IERC20(address(this));
        tokens[2] = IERC20(s.c.bean);
        // Balancer weights are bounded by 1.00 with 18 Decimals
        uint256[] memory weights;
        weights[0] = uint256(33e16);
        weights[1] = uint256(33e16);
        weights[2] = uint256(34e16);
        uint256 swapFeePercentage = uint256(5 * 10^15);
        address poolOwner = address(this);
        
        s.balancerSeedStalkBeanPool = address(IWeightedPoolFactory(BALANCER_WEIGHTED_POOL_FACTORY).create(name, 
            symbol, tokens, weights, swapFeePercentage, poolOwner));

        s.poolDepositFunctions[s.balancerSeedStalkBeanPool] = bytes4(keccak256("joinPool(bytes32,address,address,JoinPoolRequest)"));
    }
}
