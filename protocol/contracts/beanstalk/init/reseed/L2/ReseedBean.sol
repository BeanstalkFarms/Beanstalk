/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {C} from "contracts/C.sol";
import "forge-std/console.sol";

/**
 * @author Brean
 * @notice ReseedBean deploys the Bean, UnripeBean, UnripeLP ERC20s, and the BeanEth, BeanWsteth, BeanStable Wells.
 * Then adds liquidity to the BeanEth, BeanWsteth, and BeanStable well.
 * @dev each Well is upgradeable and ownable. the owner is `OWNER` when the init is called.
 */
interface IWellUpgradeable {
    function init(string memory name, string memory symbol) external;
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
    address internal constant AQUIFIER = address(0xBA51AAAA95aeEFc1292515b36D86C51dC7877773);
    address internal constant BEAN_ETH_WELL_IMPLMENTATION =
        address(0xB7df651e8e8D9cf694AA2632c66064c068a3a2c0);
    address internal constant BEAN_WSTETH_WELL_IMPLMENTATION =
        address(0xEe00E29d81c571f87C97A03C670f159513a1B62e);
    address internal constant BEAN_WEETH_WELL_IMPLMENTATION =
        address(0xD3B4FAd7c08b401838CD6C5A5F744904934a9066);
    address internal constant BEAN_WBTC_WELL_IMPLMENTATION =
        address(0xB4389f2Da821ca5B75a104a9Fe1809203aF1217c);
    address internal constant BEAN_USDC_WELL_IMPLMENTATION =
        address(0x184Eb4C03A5414a01AfC333eE36C8E082e86d981);
    address internal constant BEAN_USDT_WELL_IMPLMENTATION =
        address(0x4a8e57b15fB07ca8A2C9248bE3f99928De5A6872);

    // BEAN_ETH parameters.
    bytes32 internal constant BEAN_ETH_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000003;
    string internal constant BEAN_ETH_NAME = "BEAN:WETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_ETH_SYMBOL = "U-BEANWETHCP2w";

    // BEAN_WSTETH parameters.
    bytes32 internal constant BEAN_WSTETH_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000004;
    string internal constant BEAN_WSTETH_NAME = "BEAN:WSTETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WSTETH_SYMBOL = "U-BEANWSTETHCP2w";

    // BEAN_WEETH parameters.
    bytes32 internal constant BEAN_WEETH_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000005;
    string internal constant BEAN_WEETH_NAME = "BEAN:WEETH Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WEETH_SYMBOL = "U-BEANWEETHCCP2w";

    // BEAN_WBTC parameters.
    bytes32 internal constant BEAN_WBTC_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000004;
    string internal constant BEAN_WBTC_NAME = "BEAN:WBTC Constant Product 2 Upgradeable Well";
    string internal constant BEAN_WBTC_SYMBOL = "U-BEANWBTCCP2w";

    // BEAN_USDC parameters.
    bytes32 internal constant BEAN_USDC_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000005;
    string internal constant BEAN_USDC_NAME = "BEAN:USDC Stable 2 Upgradeable Well";
    string internal constant BEAN_USDC_SYMBOL = "U-BEANUSDCS2w";

    // BEAN_USDT parameters.
    bytes32 internal constant BEAN_USDT_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000003;
    string internal constant BEAN_USDT_NAME = "BEAN:USDT Stable 2 Upgradeable Well";
    string internal constant BEAN_USDT_SYMBOL = "U-BEANUSDTS2w";

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
        // deploy new bean contract. Issue beans.
        deployBean(beanSupply);
        // deploy new unripe bean contract.
        deployUnripeBean(unripeBeanSupply);
        // deploy new unripe lp contract.
        deployUnripeLP(unripeLpSupply);
        // wells are deployed as ERC1967Proxies in order to allow for future upgrades.
        // TODO: UNCOMMENT WHEN WELLS ARE DEPLOYED.
        deployUpgradableWells();
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
        address implementation,
        bytes32 salt,
        string memory name,
        string memory symbol
    ) internal {
        address well = address(
            new ERC1967Proxy{salt: salt}(
                implementation,
                abi.encodeCall(IWellUpgradeable.init, (name, symbol))
            )
        );
        console.log(name);
        console.log("well proxy deployed at:", well);
    }

    function deployUpgradableWells() internal {
        // BEAN/ETH well
        deployUpgradebleWell(
            BEAN_ETH_WELL_IMPLMENTATION,
            BEAN_ETH_SALT,
            BEAN_ETH_NAME,
            BEAN_ETH_SYMBOL
        );

        // BEAN/WSTETH well
        deployUpgradebleWell(
            BEAN_WSTETH_WELL_IMPLMENTATION,
            BEAN_WSTETH_SALT,
            BEAN_WSTETH_NAME,
            BEAN_WSTETH_SYMBOL
        );

        // BEAN/WEWETH well
        deployUpgradebleWell(
            BEAN_WEETH_WELL_IMPLMENTATION,
            BEAN_WEETH_SALT,
            BEAN_WEETH_NAME,
            BEAN_WEETH_SYMBOL
        );

        // BEAN/WBTC well
        deployUpgradebleWell(
            BEAN_WBTC_WELL_IMPLMENTATION,
            BEAN_WBTC_SALT,
            BEAN_WBTC_NAME,
            BEAN_WBTC_SYMBOL
        );

        // BEAN/USDC well
        deployUpgradebleWell(
            BEAN_USDC_WELL_IMPLMENTATION,
            BEAN_USDC_SALT,
            BEAN_USDC_NAME,
            BEAN_USDC_SYMBOL
        );

        // BEAN/USDT well
        deployUpgradebleWell(
            BEAN_USDT_WELL_IMPLMENTATION,
            BEAN_USDT_SALT,
            BEAN_USDT_NAME,
            BEAN_USDT_SYMBOL
        );
    }
}
