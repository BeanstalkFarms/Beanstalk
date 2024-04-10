/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";

////// Mocks //////
import {MockToken} from "contracts/mocks/MockToken.sol";

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
            string memory mock = tokens[i].targetAddr != C.WETH ? "MockToken.sol" : "MockWETH.sol"; 
            deployCodeTo(mock, abi.encode(tokens[i].name, tokens[i].symbol), tokens[i].targetAddr);
            MockToken(tokens[i].targetAddr).setDecimals(tokens[i].decimals);
            if (verbose) console.log(tokens[i].name, "Deployed at:", tokens[i].targetAddr);
            vm.label(tokens[i].targetAddr, tokens[i].name);
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
}
