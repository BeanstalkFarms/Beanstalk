/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";

import {Utils} from "test/foundry/utils/Utils.sol";

/// Mocks
import {MockToken} from "contracts/mocks/MockToken.sol";

///// TEST HELPERS ////// 
import "test/foundry/utils/BeanstalkDeployer.sol";
import "test/foundry/utils/BasinDeployer.sol";
import "test/foundry/utils/DepotDeployer.sol";
import "test/foundry/utils/OracleDeployer.sol";

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
    function initializeBeanstalkTestState(bool mock) public {
        // initalize mock tokens.
        initMockTokens();

        // initialize Depot:
        initDepot();

        // initialize Basin, deploy wells.
        initBasin(mock);

        // initialize chainlink oracles (note by default mocks).
        initChainlink();

        // initialize uniswap pools.
        initUniswapPools();
        
        // initialize Diamond:
        setupDiamond(mock);
    }

    /**
     * @notice deploys a list of mock tokens.
     * @dev each token is deployed with the MockToken.sol contract,
     * which allows for arbitary minting for testing purposes.
     */
    function initMockTokens() public {
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
            console.log(tokens[i].name, "Deployed at:", tokens[i].targetAddr);
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
    ) public {
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
    ) public {
        MockToken(token).mint(user, amount);
        vm.prank(user);
        MockToken(token).approve(BEANSTALK, type(uint256).max);
    }

}
