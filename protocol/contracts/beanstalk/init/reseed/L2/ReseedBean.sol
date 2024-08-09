/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IWell, Call} from "contracts/interfaces/basin/IWell.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {C} from "contracts/C.sol";
import {IAquifer} from "contracts/interfaces/basin/IAquifer.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "forge-std/console.sol";

/**
 * @author Brean
 * @notice ReseedBean deploys the Bean, UnripeBean, UnripeLP ERC20s, and the BeanEth, BeanWsteth,
 * BeanStable Wells and the Fertilizer proxy and implementation.
 * Then adds liquidity to the BeanEth, BeanWsteth, and BeanStable well.
 * @dev each Well is upgradeable and ownable. the owner is `OWNER` when the init is called.
 */
interface IWellUpgradeable {
    function init(string memory name, string memory symbol) external;
    function initNoWellToken() external;
}

interface IFertilizer {
    function init() external;
}

contract ReseedBean {
    struct ExternalUnripeHolders {
        address account;
        uint256 amount;
    }

    struct WellAmountData {
        uint256 beansInWell;
        uint256 nonBeanTokensInWell;
    }

    using SafeERC20 for IERC20;

    address internal constant OWNER = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

    // BEAN parameters.
    string internal constant BEAN_NAME = "Bean";
    string internal constant BEAN_SYMBOL = "BEAN";
    bytes32 internal constant BEAN_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000000;
    // UNRIPE_BEAN parameters.
    string internal constant UNRIPE_BEAN_NAME = "Unripe Bean";
    string internal constant UNRIPE_BEAN_SYMBOL = "urBEAN";
    bytes32 internal constant UNRIPE_BEAN_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000001;

    // UNRIPE_LP parameters.
    string internal constant UNRIPE_LP_NAME = "Unripe LP";
    string internal constant UNRIPE_LP_SYMBOL = "urBEANLP";
    bytes32 internal constant UNRIPE_LP_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000002;

    // Basin

    // TODO: change once addresses are finalized.
    address internal constant AQUIFER = address(0xBA51AAAA95aeEFc1292515b36D86C51dC7877773);
    address internal constant CONSTANT_PRODUCT_2 =
        address(0xBA150C2ae0f8450D4B832beeFa3338d4b5982d26);
    // TODO: Replace with actual address.
    address internal constant STABLE_2 = address(0xBA150C2ae0f8450D4B832beeFa3338d4b5982d26);
    // TODO: Replace with actual address.
    address internal constant UPGRADEABLE_WELL_IMPLEMENTATION =
        address(0x8685A763F97b6228e4CF65F8B6993BFecc932e2b);
    address internal constant MULTIFLOW_PUMP = address(0xBA51AaaAa95bA1d5efB3cB1A3f50a09165315A17);

    // BEAN_ETH parameters.
    bytes32 internal constant BEAN_ETH_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000003;
    string internal constant BEAN_ETH_NAME = "BEAN:WETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_ETH_SYMBOL = "U-BEANWETHCP2w";
    address internal constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    // BEAN_WSTETH parameters.
    bytes32 internal constant BEAN_WSTETH_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000004;
    string internal constant BEAN_WSTETH_NAME = "BEAN:WSTETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WSTETH_SYMBOL = "U-BEANWSTETHCP2w";
    address internal constant WSTETH = address(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

    // BEAN_WEETH parameters.
    bytes32 internal constant BEAN_WEETH_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000005;
    string internal constant BEAN_WEETH_NAME = "BEAN:WEETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WEETH_SYMBOL = "U-BEANWEETHCCP2w";
    address internal constant WEETH = address(0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee);

    // BEAN_WBTC parameters.
    bytes32 internal constant BEAN_WBTC_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000004;
    string internal constant BEAN_WBTC_NAME = "BEAN:WBTC Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WBTC_SYMBOL = "U-BEANWBTCCP2w";
    address internal constant WBTC = address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

    // BEAN_USDC parameters.
    bytes32 internal constant BEAN_USDC_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000005;
    string internal constant BEAN_USDC_NAME = "BEAN:USDC Stable 2 Upgradeable Well";
    string internal constant BEAN_USDC_SYMBOL = "U-BEANUSDCS2w";
    address internal constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    // BEAN_USDT parameters.
    bytes32 internal constant BEAN_USDT_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000003;
    string internal constant BEAN_USDT_NAME = "BEAN:USDT Stable 2 Upgradeable Well";
    string internal constant BEAN_USDT_SYMBOL = "U-BEANUSDTS2w";
    address internal constant USDT = address(0xdAC17F958D2ee523a2206206994597C13D831ec7);

    // Fertilizer
    bytes32 internal constant FERTILIZER_PROXY_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    /**
     * @notice deploys bean, unripe bean, unripe lp, and wells.
     * @dev mints bean assets to the beanstalk contract,
     * and mints the bean sided liquidity to the well.
     * Additionally, issues external unripe bean and unripe LP to users.
     */
    function init(
        uint256 beanSupply,
        uint256 unripeBeanSupply,
        uint256 unripeLpSupply,
        WellAmountData calldata beanEthAmounts,
        WellAmountData calldata beanWstethAmounts,
        WellAmountData calldata beanStableAmounts,
        ExternalUnripeHolders[] calldata urBean,
        ExternalUnripeHolders[] calldata urBeanLP
    ) external {
        // deploy the fertilizer proxy and implementation
        deployFertilizer();
        // deploy new bean contract. Issue beans.
        BeanstalkERC20 bean = deployBean(beanSupply);
        // deploy new unripe bean contract.
        deployUnripeBean(unripeBeanSupply);
        // deploy new unripe lp contract.
        deployUnripeLP(unripeLpSupply);
        // wells are deployed as ERC1967Proxies in order to allow for future upgrades.
        deployUpgradableWells(address(bean));
    }

    function deployFertilizer() internal {
        // TODO: Get new bytecode from misc bip and mine for fert salt
        // deploy fertilizer implementation
        Fertilizer fertilizer = new Fertilizer();
        // deploy fertilizer proxy. Set owner to beanstalk.
        TransparentUpgradeableProxy fertilizerProxy = new TransparentUpgradeableProxy{
            salt: FERTILIZER_PROXY_SALT
        }(
            address(fertilizer), // logic
            address(this), // admin (diamond)
            abi.encode(IFertilizer.init.selector) // init data
        );
        console.log("Fertilizer deployed at: ", address(fertilizerProxy));
    }

    function deployBean(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 bean = new BeanstalkERC20{salt: BEAN_SALT}(
            address(this),
            BEAN_NAME,
            BEAN_SYMBOL
        );
        bean.mint(address(this), supply);
        console.log("Bean deployed at: ", address(bean));
        return bean;
    }

    function deployUnripeBean(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 unripeBean = new BeanstalkERC20{salt: UNRIPE_BEAN_SALT}(
            address(this),
            UNRIPE_BEAN_NAME,
            UNRIPE_BEAN_SYMBOL
        );
        unripeBean.mint(address(this), supply);
        console.log("Unripe Bean deployed at: ", address(unripeBean));
        return unripeBean;
    }

    function deployUnripeLP(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 unripeLP = new BeanstalkERC20{salt: UNRIPE_LP_SALT}(
            address(this),
            UNRIPE_LP_NAME,
            UNRIPE_LP_SYMBOL
        );
        unripeLP.mint(address(this), supply);
        console.log("Unripe LP deployed at: ", address(unripeLP));
        return unripeLP;
    }

    function deployUpgradebleWell(
        IERC20[] memory tokens,
        Call memory wellFunction,
        Call[] memory pumps,
        bytes32 salt,
        string memory name,
        string memory symbol
    ) internal {
        // Encode well data
        (bytes memory immutableData, bytes memory initData) = encodeWellDeploymentData(
            AQUIFER,
            tokens,
            wellFunction,
            pumps
        );

        // Bore upgradeable well
        address _well = IAquifer(AQUIFER).boreWell(
            UPGRADEABLE_WELL_IMPLEMENTATION,
            immutableData,
            initData,
            salt
        );

        // Deploy proxy
        address wellProxy = address(
            new ERC1967Proxy{salt: salt}(
                _well,
                abi.encodeCall(IWellUpgradeable.init, (name, symbol))
            )
        );
    }

    function deployUpgradableWells(address bean) internal {
        // tokens
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = IERC20(bean);
        tokens[1] = IERC20(WETH);

        // cp2
        Call memory cp2;
        cp2.target = CONSTANT_PRODUCT_2;

        // stable2
        uint256 beanDecimals = 1e6;
        uint256 stableDecimals = 1e6;
        bytes memory stable2Data = abi.encode(beanDecimals, stableDecimals);
        Call memory stable2 = Call(STABLE_2, stable2Data);

        // pump
        Call[] memory pumps = new Call[](1);
        // Note: mfpData will need to be updated based on the L2 block time.
        bytes
            memory mfpData = hex"3ffeef368eb04325c526c2246eec3e5500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000603ff9eb851eb851eb851eb851eb851eb8000000000000000000000000000000003ff9eb851eb851eb851eb851eb851eb8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003ff747ae147ae147ae147ae147ae147a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023ff747ae147ae147ae147ae147ae147a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        pumps[0] = Call(MULTIFLOW_PUMP, mfpData);

        // BEAN/ETH well
        deployUpgradebleWell(
            tokens, // tokens (IERC20[])
            cp2, // well function (Call)
            pumps, // pumps (Call[])
            BEAN_ETH_SALT, // salt
            BEAN_ETH_NAME, // name
            BEAN_ETH_SYMBOL // symbol
        );

        // BEAN/WSTETH well
        tokens[1] = IERC20(WSTETH);
        deployUpgradebleWell(
            tokens, // tokens (IERC20[])
            cp2, // well function (Call)
            pumps, // pumps (Call[])
            BEAN_WSTETH_SALT,
            BEAN_WSTETH_NAME,
            BEAN_WSTETH_SYMBOL
        );

        // BEAN/WEWETH well
        tokens[1] = IERC20(WEETH);
        deployUpgradebleWell(
            tokens, // tokens (IERC20[])
            cp2, // well function (Call)
            pumps, // pumps (Call[])
            BEAN_WEETH_SALT,
            BEAN_WEETH_NAME,
            BEAN_WEETH_SYMBOL
        );

        // BEAN/WBTC well
        tokens[1] = IERC20(WBTC);
        deployUpgradebleWell(
            tokens, // tokens (IERC20[])
            cp2, // well function (Call)
            pumps, // pumps (Call[])
            BEAN_WBTC_SALT,
            BEAN_WBTC_NAME,
            BEAN_WBTC_SYMBOL
        );

        // BEAN/USDC well
        // USDC uses 6 decimals
        tokens[1] = IERC20(USDC);
        deployUpgradebleWell(
            tokens, // tokens (IERC20[])
            stable2, // well function (Call)
            pumps, // pumps (Call[])
            BEAN_USDC_SALT,
            BEAN_USDC_NAME,
            BEAN_USDC_SYMBOL
        );

        // BEAN/USDT well
        // USDT uses 6 decimals
        tokens[1] = IERC20(USDT);
        deployUpgradebleWell(
            tokens, // tokens (IERC20[])
            stable2, // well function (Call)
            pumps, // pumps (Call[])
            BEAN_USDT_SALT,
            BEAN_USDT_NAME,
            BEAN_USDT_SYMBOL
        );
    }

    /////////////////////// Helper Functions ///////////////////////

    function encodeWellImmutableData(
        address _aquifer,
        IERC20[] memory _tokens,
        Call memory _wellFunction,
        Call[] memory _pumps
    ) internal pure returns (bytes memory immutableData) {
        immutableData = abi.encodePacked(
            _aquifer, // aquifer address
            _tokens.length, // number of tokens
            _wellFunction.target, // well function address
            _wellFunction.data.length, // well function data length
            _pumps.length, // number of pumps
            _tokens, // tokens array
            _wellFunction.data // well function data (bytes)
        );
        for (uint256 i; i < _pumps.length; ++i) {
            immutableData = abi.encodePacked(
                immutableData, // previously packed pumps
                _pumps[i].target, // pump address
                _pumps[i].data.length, // pump data length
                _pumps[i].data // pump data (bytes)
            );
        }
    }

    /**
     * @notice Encode the Well's immutable data.
     */
    function encodeWellDeploymentData(
        address _aquifer,
        IERC20[] memory _tokens,
        Call memory _wellFunction,
        Call[] memory _pumps
    ) internal pure returns (bytes memory immutableData, bytes memory initData) {
        immutableData = encodeWellImmutableData(_aquifer, _tokens, _wellFunction, _pumps);
        initData = abi.encodeWithSelector(IWellUpgradeable.initNoWellToken.selector);
    }
}
