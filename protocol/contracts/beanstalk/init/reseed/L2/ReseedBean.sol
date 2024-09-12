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
import {IAquifer} from "contracts/interfaces/basin/IAquifer.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "forge-std/console.sol";

/**
 * @author Brean
 * @notice ReseedBean deploys the Bean, UnripeBean, UnripeLP ERC20s, and the BeanEth, BeanWsteth,
 * BeanStable Wells.
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

    using SafeERC20 for IERC20;

    address internal constant OWNER = address(0xa9bA2C40b263843C04d344727b954A545c81D043);
    AppStorage internal s;

    // A default well salt is used to prevent front-running attacks
    // as the aquifer also uses msg.sender when boring with non-zero salt.
    bytes32 internal constant DEFAULT_WELL_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000001;

    // BEAN parameters.
    string internal constant BEAN_NAME = "Bean";
    string internal constant BEAN_SYMBOL = "BEAN";
    bytes32 internal constant BEAN_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb70546985ec75f817106d8f4f88;
    // UNRIPE_BEAN parameters.
    string internal constant UNRIPE_BEAN_NAME = "Unripe Bean";
    string internal constant UNRIPE_BEAN_SYMBOL = "urBEAN";
    bytes32 internal constant UNRIPE_BEAN_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb705681376833356743b5b87351;

    // UNRIPE_LP parameters.
    string internal constant UNRIPE_LP_NAME = "Unripe LP";
    string internal constant UNRIPE_LP_SYMBOL = "urBEANLP";
    bytes32 internal constant UNRIPE_LP_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb707788b5b26d4b8534e89ca031;

    // Basin
    address internal constant AQUIFER = address(0xBA51AAAa8C2f911AE672e783707Ceb2dA6E97521);
    address internal constant CONSTANT_PRODUCT_2 =
        address(0xBA5104f2df98974A83CD10d16E24282ce6Bb647f);
    address internal constant STABLE_2 = address(0xBA51055Ac3068Ffd884B495BF58314493cde9653);
    address internal constant UPGRADEABLE_WELL_IMPLEMENTATION =
        address(0xBA510995783111be5301d93CCfD5dE4e3B28e50B);
    address internal constant MULTIFLOW_PUMP = address(0xBA510482E3e6B96C88A1fe34Ce58385fB554C9a9);

    // BEAN_ETH parameters.
    bytes32 internal constant BEAN_ETH_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb70cf610e2f8ba3a784783d50c7;
    string internal constant BEAN_ETH_NAME = "BEAN:WETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_ETH_SYMBOL = "U-BEANWETHCP2w";
    address internal constant WETH = address(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);

    // BEAN_WSTETH parameters.
    bytes32 internal constant BEAN_WSTETH_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb702dd812d82cc04280f90dac20;
    string internal constant BEAN_WSTETH_NAME = "BEAN:WSTETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WSTETH_SYMBOL = "U-BEANWSTETHCP2w";
    address internal constant WSTETH = address(0x5979D7b546E38E414F7E9822514be443A4800529);

    // BEAN_WEETH parameters.
    bytes32 internal constant BEAN_WEETH_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb7076e0c3991a85b21f3c6d2327;
    string internal constant BEAN_WEETH_NAME = "BEAN:WEETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WEETH_SYMBOL = "U-BEANWEETHCCP2w";
    address internal constant WEETH = address(0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe);

    // BEAN_WBTC parameters.
    bytes32 internal constant BEAN_WBTC_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb7031803f7cfbaef420a33da4e2;
    string internal constant BEAN_WBTC_NAME = "BEAN:WBTC Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WBTC_SYMBOL = "U-BEANWBTCCP2w";
    address internal constant WBTC = address(0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f);

    // BEAN_USDC parameters.
    bytes32 internal constant BEAN_USDC_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb7029aa50efeb2cc4e37ef5b62c;
    string internal constant BEAN_USDC_NAME = "BEAN:USDC Stable 2 Upgradeable Well";
    string internal constant BEAN_USDC_SYMBOL = "U-BEANUSDCS2w";
    address internal constant USDC = address(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);

    // BEAN_USDT parameters.
    bytes32 internal constant BEAN_USDT_SALT =
        0xd1a0060ba708bc4bcd3da6c37efa8dedf015fb7082e11ce3f89b8cd399ffa9ee;
    string internal constant BEAN_USDT_NAME = "BEAN:USDT Stable 2 Upgradeable Well";
    string internal constant BEAN_USDT_SYMBOL = "U-BEANUSDTS2w";
    address internal constant USDT = address(0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9);

    // Fertilizer
    bytes32 internal constant FERTILIZER_PROXY_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    // BCM (TODO: Replace with actual L2 address)
    address internal constant L2_BCM = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

    /**
     * @notice deploys bean, unripe bean, unripe lp, and wells.
     * @dev mints bean assets to the beanstalk contract,
     * and mints the bean sided liquidity to the well.
     * Additionally, issues external unripe bean and unripe LP to users.
     */
    function init(
        uint256 beanSupply,
        uint256 internalUrBeanSupply,
        uint256 internalUnripeLpSupply,
        uint256 wethBeans,
        uint256 wstEthBeans,
        uint256 stableBeans,
        ExternalUnripeHolders[] calldata urBean,
        ExternalUnripeHolders[] calldata urBeanLP,
        address fertImplementation
    ) external {
        deployFertilizerProxy(fertImplementation);
        // deploy new bean contract. Issue beans.
        BeanstalkERC20 bean = deployBean(beanSupply);
        // deploy new unripe bean contract. Issue external unripe beans and urLP.
        BeanstalkERC20 unripeBean = deployUnripeBean(internalUrBeanSupply, urBean);
        // deploy new unripe lp contract.
        BeanstalkERC20 unripeLP = deployUnripeLP(internalUnripeLpSupply, urBeanLP);
        // wells are deployed as ERC1967Proxies in order to allow for future upgrades.
        deployUpgradableWells(address(bean));
        // mint beans to the bcm according to the amounts in the l1 wells.
        mintBeansToBCM(bean, wethBeans, wstEthBeans, stableBeans);
    }


    function deployFertilizerProxy(address fertImplementation) internal {
        // deploy fertilizer proxy. Set owner to beanstalk.
        TransparentUpgradeableProxy fertilizerProxy = new TransparentUpgradeableProxy{
            salt: FERTILIZER_PROXY_SALT
        }(
            fertImplementation, // logic
            address(this), // admin (diamond)
            abi.encode(IFertilizer.init.selector) // init data
        );
        // init token:
        s.sys.tokens.fertilizer = address(fertilizerProxy);
        console.log("Fertilizer Proxy deployed at: ", address(fertilizerProxy));
        console.log("Fertilizer Proxy implementation: ", fertImplementation);
    }

    function mintBeansToBCM(
        BeanstalkERC20 bean,
        uint256 wethBeans,
        uint256 wstEthBeans,
        uint256 stableBeans
    ) internal {
        // total beans is the sum of the bean sided liquidity in the wells.
        // Needed for bcm to add liquidity to the L2 wells after the migration.
        uint256 totalBeans = wethBeans + wstEthBeans + stableBeans;
        bean.mint(L2_BCM, totalBeans);
    }

    function deployBean(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 bean = new BeanstalkERC20{salt: BEAN_SALT}(
            address(this),
            BEAN_NAME,
            BEAN_SYMBOL
        );
        s.sys.tokens.bean = address(bean);
        bean.mint(address(this), supply);
        console.log("Bean deployed at: ", address(bean));
        return bean;
    }

    function deployUnripeBean(
        uint256 supply,
        ExternalUnripeHolders[] memory externalUrBean
    ) internal returns (BeanstalkERC20) {
        BeanstalkERC20 unripeBean = new BeanstalkERC20{salt: UNRIPE_BEAN_SALT}(
            address(this),
            UNRIPE_BEAN_NAME,
            UNRIPE_BEAN_SYMBOL
        );
        s.sys.tokens.urBean = address(unripeBean);
        unripeBean.mint(address(this), supply);
        console.log("Unripe Bean deployed at: ", address(unripeBean));

        for (uint i; i < externalUrBean.length; i++) {
            unripeBean.mint(externalUrBean[i].account, externalUrBean[i].amount);
        }
        return unripeBean;
    }

    function deployUnripeLP(
        uint256 supply,
        ExternalUnripeHolders[] memory externalUrLP
    ) internal returns (BeanstalkERC20) {
        BeanstalkERC20 unripeLP = new BeanstalkERC20{salt: UNRIPE_LP_SALT}(
            address(this),
            UNRIPE_LP_NAME,
            UNRIPE_LP_SYMBOL
        );
        s.sys.tokens.urLp = address(unripeLP);
        unripeLP.mint(address(this), supply);
        console.log("Unripe LP deployed at: ", address(unripeLP));

        for (uint i; i < externalUrLP.length; i++) {
            unripeLP.mint(externalUrLP[i].account, externalUrLP[i].amount);
        }
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

        // Bore upgradeable well with the same salt for reproducibility.
        // The address of this is irrelevant, we just need it to be constant, this is why no salt is used.
        address _well = IAquifer(AQUIFER).boreWell(
            UPGRADEABLE_WELL_IMPLEMENTATION,
            immutableData,
            initData,
            DEFAULT_WELL_SALT
        );

        // Deploy proxy
        address wellProxy = address(
            new ERC1967Proxy{salt: salt}(
                _well,
                abi.encodeCall(IWellUpgradeable.init, (name, symbol))
            )
        );

        console.log("Well Proxy for token pair %s deployed at: %s", name, wellProxy);
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
        uint256 beanDecimals = 6;
        uint256 stableDecimals = 6;
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
