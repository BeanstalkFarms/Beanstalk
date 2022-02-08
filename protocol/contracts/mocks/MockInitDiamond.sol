/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "../mocks/MockToken.sol";
import "../mocks/MockUniswapV2Pair.sol";
import "../mocks/MockUniswapV2Router.sol";
import {AppStorage} from "../farm/AppStorage.sol";
import {LibMarket} from "../libraries/LibMarket.sol";
import {LibStalk} from "../libraries/LibStalk.sol";
import "../Seed.sol";
import "../interfaces/ISeed.sol";
import "../interfaces/balancer/IWeightedPoolFactory.sol";
import "../interfaces/balancer/IVault.sol";
import "../interfaces/balancer/IBasePool.sol";
/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    address private constant BALANCER_WEIGHTED_POOL_FACTORY = address(0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9);
    address private constant BALANCER_VAULT = address(0xBA12222222228d8Ba445958a75a0704d566BF2C8);        

    function init(address mockRouter) external {
        s.c.bean = address(new MockToken("BEAN", "Beanstalk"));
        s.c.pair = address(new MockUniswapV2Pair(s.c.bean));
        s.c.pegPair = address(new MockUniswapV2Pair(s.c.weth));
        MockUniswapV2Router(mockRouter).setPair(s.c.pair);
        s.c.weth = IUniswapV2Router02(mockRouter).WETH();

        IBean(s.c.bean).approve(mockRouter, uint256(-1));
        IUniswapV2Pair(s.c.pair).approve(mockRouter, uint256(-1));
        IWETH(s.c.weth).approve(mockRouter, uint256(-1));

        s.cases = [int8(3),1,0,0,-1,-3,-3,0,3,1,0,0,-1,-3,-3,0,3,3,1,0,0,0,-1,0,3,3,1,0,1,0,-1,0];
        s.w.yield = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.start = block.timestamp;
        s.season.timestamp = block.timestamp;

        s.index = (IUniswapV2Pair(s.c.pair).token0() == s.c.bean) ? 0 : 1;
        LibMarket.initMarket(s.c.bean, s.c.weth, mockRouter);
        LibStalk.initStalkToken('Stalk', 'STALK');
       	
        s.ss[s.c.pair].selector = bytes4(keccak256("uniswapLPtoBDV(address,uint256)")); 
        s.ss[s.c.pair].seeds = 4;
        s.ss[s.c.pair].stalk = 10000;
        
        // Balancer Stalk, Seed, Bean Pool Creation
        bytes memory bytecode = type(Seed).creationCode;
        // Generate Salt using Owner of Seed Contract
        bytes32 salt = keccak256(abi.encodePacked(address(this), "SEED"));
        address seedAddress;
        assembly {
            seedAddress := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        s.seedContract = seedAddress;

        s.balancerVault = BALANCER_VAULT;

        // Balancer Pool Parameters

        // Later put this into a Balancer Deploy Library
        string memory name = "Three-Token Bean, Stalk, Seeds Test Pool";
        string memory symbol = "33SEED-33STALK-34Bean";
        IERC20[] memory tokens = new IERC20[](3);
        tokens[0] = IERC20(address(this));
        tokens[1] = IERC20(s.c.bean);
        tokens[2] = IERC20(seedAddress);
        // Balancer weights are bounded by 1.00 with 18 Decimals
        uint256[] memory weights = new uint256[](3);
        weights[0] = uint256(33e16);
        weights[1] = uint256(34e16);
        weights[2] = uint256(33e16);
        uint256 swapFeePercentage = uint256(5e16);
        address poolOwner = address(this);
        address balancerPool = address(IWeightedPoolFactory(BALANCER_WEIGHTED_POOL_FACTORY).create(name, 
            symbol, tokens, weights, swapFeePercentage, poolOwner));

        s.beanSeedStalk3Pair.poolAddress = balancerPool;
        s.beanSeedStalk3Pair.poolId = IBasePool(balancerPool).getPoolId();

        // Register these tokens permissions in Balancer with Silo as Owner
        // function registerTokens(
        // bytes32 poolId,
        // IERC20[] memory tokens,
        // address[] memory assetManagers
        // ) external;
        address[] memory assetManagers = new address[](3);
        assetManagers[0] = address(0);
        assetManagers[1] = address(0);
        assetManagers[2] = address(0);
        
        // 
        // IVault(BALANCER_VAULT).registerTokens(s.beanSeedStalk3Pair.poolId, tokens, assetManagers);

        s.poolDepositFunctions[balancerPool] = bytes4(keccak256("joinPool(bytes32,address,address,JoinPoolRequest)"));
    }

}
