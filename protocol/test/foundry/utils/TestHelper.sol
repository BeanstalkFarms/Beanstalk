/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";

////// Mocks //////
import {MockToken} from "contracts/mocks/MockToken.sol";
import {MockBlockBasefee} from "contracts/mocks/MockBlockBasefee.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";

///// TEST HELPERS ////// 
import {BeanstalkDeployer} from "test/foundry/utils/BeanstalkDeployer.sol";
import {BasinDeployer} from "test/foundry/utils/BasinDeployer.sol";
import {DepotDeployer} from "test/foundry/utils/DepotDeployer.sol";
import {OracleDeployer} from "test/foundry/utils/OracleDeployer.sol";
import {LibWell, IWell, IERC20} from "contracts/libraries/Well/LibWell.sol";
import {C} from "contracts/C.sol";


///// COMMON IMPORTED LIBRARIES //////
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract TestHelper is Test, BeanstalkDeployer, BasinDeployer, DepotDeployer, OracleDeployer {

    // general mock interface for beanstalk.
    IMockFBeanstalk bs = IMockFBeanstalk(BEANSTALK);

    // ideally, timestamp should be set to 1_000_000.
    // however, beanstalk rounds down to the nearest hour. 
    // 1_000_000 / 3600 * 3600 = 997200. 
    uint256 constant PERIOD = 3600;
    uint256 constant START_TIMESTAMP = 1_000_000;
    uint256 constant INITIAL_TIMESTAMP = (START_TIMESTAMP / PERIOD) * PERIOD;
    struct initERC20params {
        address targetAddr;
        string name;
        string symbol;
        uint8 decimals;
    }

    /**
     * @notice initializes the state of the beanstalk contracts for testing.
     */
    function initializeBeanstalkTestState(bool mock, bool verbose) public {

        // initialize misc contracts.
        initMisc();

        // sets block.timestamp to 1_000_000, 
        // as starting from an timestamp of 0 can cause issues.
        vm.warp(INITIAL_TIMESTAMP);

        // set block base fee to 1 gwei.
        MockBlockBasefee(BASE_FEE_CONTRACT).setAnswer(1e9);

        // initalize mock tokens.
        initMockTokens(verbose);

        // initialize Depot:
        initDepot(verbose);

        // initialize Basin, deploy wells.
        initBasin(mock, verbose);

        // initialize chainlink oracles (note by default mocks).
        initChainlink(verbose);

        // initialize uniswap pools.
        initUniswapPools(verbose);
        
        // initialize Diamond, initalize users:
        setupDiamond(mock, verbose);
    }

    /**
     * @notice deploys a list of mock tokens.
     * @dev each token is deployed with the MockToken.sol contract,
     * which allows for arbitary minting for testing purposes.
     */
    function initMockTokens(bool verbose) internal {
        initERC20params[5] memory tokens = [
            initERC20params(C.BEAN, 'Bean','BEAN', 6),
            initERC20params(C.UNRIPE_BEAN, 'Unripe Bean','UrBEAN', 6),
            initERC20params(C.UNRIPE_LP, 'Unripe BEAN3CRV','UrBEAN3CRV', 18),
            initERC20params(C.WETH, 'Weth','WETH', 18),
            initERC20params(C.WSTETH, 'wstETH','WSTETH', 18)
        ];

        for(uint i; i < tokens.length; i++) {

            address token = tokens[i].targetAddr;
            string memory name = tokens[i].name;
            string memory symbol = tokens[i].symbol;
            uint256 decimals = tokens[i].decimals;

            string memory mock = "MockToken.sol";
            // unique ERC20s should be appended here.
            if (token == C.WETH) {
                mock = "MockWETH.sol";
            } else if (token == C.WSTETH) {
                mock = "MockWsteth.sol";
            }
            deployCodeTo(mock, abi.encode(name, symbol), token);
            MockToken(token).setDecimals(decimals);
            if (verbose) console.log(name, "Deployed at:", token);
            vm.label(token, name);
        }
    }

    /**
     * @notice max approves bean for beanstalk.
     */
    function maxApproveBeanstalk(
        address[] memory users
    ) public {
        for(uint i; i < users.length; i++) {
            vm.prank(users[i]);
            C.bean().approve(BEANSTALK, type(uint256).max);
        }
    }

    /**
     * @notice Mints tokens to a list of users.
     * @dev Max approves beanstalk to spend `token`.
     */
    function mintTokensToUsers(
        address[] memory users,
        address token,
        uint256 amount
    ) internal {
        for(uint i; i < users.length; i++) {
            mintTokensToUser(users[i], token, amount);
        }
    }

    /**
     * @notice Mints tokens to a list of users.
     * @dev Max approves beanstalk to spend `token`.
     */
    function mintTokensToUser(
        address user,
        address token,
        uint256 amount
    ) internal {
        MockToken(token).mint(user, amount);
        vm.prank(user);
        MockToken(token).approve(BEANSTALK, type(uint256).max);
    }

    /**
     * @notice assumes a CP2 well with bean as one of the tokens.
     */
    function addLiquidityToWell(
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal {
        
        (address nonBeanToken, ) = LibWell.getNonBeanTokenAndIndexFromWell(
            well
        );
        
        // mint and sync.
        MockToken(C.BEAN).mint(well, beanAmount);
        MockToken(nonBeanToken).mint(well, nonBeanTokenAmount);

        // inital liquidity owned by beanstalk deployer.
        IWell(well).sync(users[0], 0);

        // sync again to update reserves.
        IWell(well).sync(users[0], 0);
    }

    /**
     * @notice sets the reserves of a well by adding/removing liquidity.
     * @dev if the reserves decrease, manually remove liquidity. 
     * if the reserves incerase, add token amounts and sync.
     */
    function setReserves(
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal prank(users[0]) {
        uint256[] memory reserves = new uint256[](2);
        IERC20[] memory tokens = new IERC20[](2);
        tokens = IWell(well).tokens();
        reserves = IWell(well).getReserves();
        uint256 beanIndex = LibWell.getBeanIndex(tokens);
        uint256 tknIndex = beanIndex == 1 ? 0 : 1;

       uint256[] memory removedTokens = new uint256[](2);

        // calculate amount of tokens to remove.
        if (reserves[beanIndex] > beanAmount) {
            removedTokens[beanIndex] = reserves[beanIndex] - beanAmount;
        }

        if (reserves[tknIndex] > nonBeanTokenAmount) {
            removedTokens[tknIndex] = reserves[tknIndex] - nonBeanTokenAmount;
        }

        // liquidity is removed first. 
        IWell(well).removeLiquidityImbalanced(
            type(uint256).max,
            removedTokens,
            users[0],
            type(uint256).max
        );

        // mint amount to add to well, call sync.
        if (reserves[beanIndex] < beanAmount) {
            C.bean().mint(well, beanAmount - reserves[beanIndex]);
        }
        if (reserves[tknIndex] < nonBeanTokenAmount) {
            MockToken(address(tokens[tknIndex])).mint(well, nonBeanTokenAmount - reserves[tknIndex]);
        }

        IWell(well).sync(users[0], 0);
    }

    function initMisc() internal {
        deployCodeTo("MockBlockBasefee.sol", BASE_FEE_CONTRACT);
    }

    function abs(int256 x) internal pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    function initializeChainlinkOraclesForWhitelistedWells() internal noGasMetering {
        address[] memory lp = bs.getWhitelistedLpTokens();
        address chainlinkOracle;
        for(uint i; i < lp.length; i++) {
            // oracles will need to be added here, 
            // as obtaining the chainlink oracle to well is not feasible on chain.
            if (lp[i] == C.BEAN_ETH_WELL) {
                chainlinkOracle = chainlinkOracles[0];
            } else if (lp[i] == C.BEAN_WSTETH_WELL) {
                chainlinkOracle = chainlinkOracles[1];
            }
            updateChainlinkOracleWithPreviousData(chainlinkOracle);
        }
    }

    function setDeltaBForWellsWithEntropy(
        uint256 entropy
    ) internal returns (int256[] memory deltaBPerWell) { 
        address[] memory lps = bs.getWhitelistedWellLpTokens();
        deltaBPerWell = new int256[](lps.length);
        for(uint i; i < lps.length; i++) {
            // unix time is used to generate an unique deltaB upon every test.
            int256 deltaB = int256(keccak256(abi.encode(entropy, i, vm.unixTime())));
            deltaB = bound(deltaB, -1000e6, 1000e6);
            (address tokenInWell, ) = LibWell.getNonBeanTokenAndIndexFromWell(lps[i]);
            setDeltaBforWell(deltaB, lps[i], tokenInWell);
            deltaBPerWell[i] = deltaB;
        }
    }

    /**
     * @notice update deltaB in wells. excess is minted to the well.
     * commands are called twice to update pumps, due to mocks and everything
     * executing in the same block.
     */
    function setDeltaBforWell(int256 deltaB, address wellAddress, address tokenInWell) internal {
        IWell well = IWell(wellAddress);
        IERC20 tokenOut;
        uint256 initalBeanBalance = C.bean().balanceOf(wellAddress);
        if (deltaB > 0) {
            uint256 tokenAmountIn = well.getSwapIn(IERC20(tokenInWell), C.bean(), uint256(deltaB));
            MockToken(tokenInWell).mint(wellAddress, tokenAmountIn);
            tokenOut = C.bean();
        } else { 
            C.bean().mint(wellAddress, uint256(-deltaB));
            tokenOut = IERC20(tokenInWell);
        }
        uint256 amountOut = well.shift(tokenOut, 0, users[1]);
        well.shift(tokenOut, 0, users[1]);
    }
}
