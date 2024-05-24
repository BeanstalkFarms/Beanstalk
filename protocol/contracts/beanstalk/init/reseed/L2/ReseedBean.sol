/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedBean deploys the Bean, UnripeBean, UnripeLP ERC20s, and the BeanEth, BeanWsteth, BeanStable Wells.
 * Then adds liquidity to the beanEth, beanWsteth, and beanStable well.
 * @dev each well is upgradeable and ownable. the owner is `owner` when the init is called.
 */
// TODO: replace with implmentation once developed.
interface IWellUpgradeable {
    function init(string memory name, string memory symbol, address owner) external;
}

contract ReseedBean {
    using SafeERC20 for IERC20;

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

    address internal constant AQUIFIER = address(0);
    address internal constant CP2_U_BEAN_ETH_WELL_IMPLMENTATION = address(0);
    address internal constant CP2_U_BEAN_WSTETH_WELL_IMPLMENTATION = address(0);
    address internal constant SS_U_BEAN_STABLE_WELL_IMPLMENTATION = address(0);
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

    // BEAN_STABLE parameters. (note: usdc is used as a placeholder)
    bytes32 internal constant BEAN_STABLE_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000005;
    string internal constant BEAN_STABLE_NAME = "BEAN:WSTETH StableSwap 2 Upgradeable Well";
    string internal constant BEAN_STABLE_SYMBOL = "U-BEANUSDCSS2w";

    AppStorage internal s;

    /**
     * @notice deploys bean, unripe bean, unripe lp, and wells.
     * @dev mints bean assets to the beanstalk contract,
     * and mints the bean sided liquidity to the well.
     */
    function init(
        address owner,
        uint256 beanSupply,
        uint256 unripeBeanSupply,
        uint256 unripeLpSupply,
        uint256 beanInBeanEthWell,
        uint256 ethInBeanEthWell,
        uint256 beanInBeanWstEthWell,
        uint256 wstEthInBeanWstEthWell,
        uint256 beanInBeanStableWell,
        uint256 stableInBeanStableWell
    ) external {
        // deploy new bean contract. Issue beans.
        BeanstalkERC20 bean = deployBean(beanSupply);

        // deploy new unripe bean contract.
        deployUnripeBean(unripeBeanSupply);

        // deploy new unripe lp contract.
        deployUnripeLP(unripeLpSupply);

        // wells are deployed as ERC1967Proxies in order to allow for future upgrades.

        // deploy new beanEthWell contract.
        deployBeanEthWell(owner, bean, beanInBeanEthWell, ethInBeanEthWell);

        // deploy new beanWstEthWell contract.
        deployBeanWstEthWell(owner, bean, wstEthInBeanWstEthWell, beanInBeanWstEthWell);

        // deploy new beanStableWell contract.
        deployBeanStableWell(owner, bean, stableInBeanStableWell, beanInBeanStableWell);
    }

    function deployBean(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 bean = new BeanstalkERC20{salt: BEAN_SALT}(
            address(this),
            BEAN_NAME,
            BEAN_SYMBOL
        );
        bean.mint(address(this), supply);
        return bean;
    }

    function deployUnripeBean(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 unripeBean = new BeanstalkERC20{salt: UNRIPE_BEAN_SALT}(
            address(this),
            UNRIPE_BEAN_NAME,
            UNRIPE_BEAN_SYMBOL
        );
        unripeBean.mint(address(this), supply);
        return unripeBean;
    }

    function deployUnripeLP(uint256 supply) internal returns (BeanstalkERC20) {
        BeanstalkERC20 unripeLP = new BeanstalkERC20{salt: UNRIPE_LP_SALT}(
            address(this),
            UNRIPE_LP_NAME,
            UNRIPE_LP_SYMBOL
        );
        unripeLP.mint(address(this), supply);
        return unripeLP;
    }

    function deployBeanEthWell(
        address owner,
        BeanstalkERC20 bean,
        uint256 beanAmount,
        uint256 wethAmount
    ) internal returns (IWell) {
        address beanEthWell = address(
            new ERC1967Proxy{salt: BEAN_ETH_SALT}(
                CP2_U_BEAN_ETH_WELL_IMPLMENTATION,
                abi.encodeCall(IWellUpgradeable.init, (BEAN_ETH_NAME, BEAN_ETH_SYMBOL, owner))
            )
        );

        bean.mint(beanEthWell, beanAmount);
        (address weth, ) = LibWell.getNonBeanTokenAndIndexFromWell(beanEthWell);
        IERC20(weth).safeTransferFrom(owner, beanEthWell, wethAmount);
        IWell(beanEthWell).sync(address(this), 0); // sync the well.
        return IWell(beanEthWell);
    }

    function deployBeanWstEthWell(
        address owner,
        BeanstalkERC20 bean,
        uint256 beanAmount,
        uint256 wstethAmount
    ) internal returns (IWell) {
        address beanWstEthWell = address(
            new ERC1967Proxy{salt: BEAN_WSTETH_SALT}(
                CP2_U_BEAN_WSTETH_WELL_IMPLMENTATION,
                abi.encodeCall(IWellUpgradeable.init, (BEAN_WSTETH_NAME, BEAN_WSTETH_SYMBOL, owner))
            )
        );
        bean.mint(address(beanWstEthWell), beanAmount);
        (address wsteth, ) = LibWell.getNonBeanTokenAndIndexFromWell(beanWstEthWell);
        IERC20(wsteth).safeTransferFrom(owner, beanWstEthWell, wstethAmount);
        IWell(beanWstEthWell).sync(address(this), 0); // sync the well.
        return IWell(beanWstEthWell);
    }

    function deployBeanStableWell(
        address owner,
        BeanstalkERC20 bean,
        uint256 beanAmount,
        uint256 stableAmount
    ) internal returns (IWell) {
        address beanStableWell = address(
            new ERC1967Proxy{salt: BEAN_STABLE_SALT}(
                SS_U_BEAN_STABLE_WELL_IMPLMENTATION,
                abi.encodeCall(IWellUpgradeable.init, (BEAN_STABLE_NAME, BEAN_STABLE_SYMBOL, owner))
            )
        );
        bean.mint(beanStableWell, beanAmount);
        (address stable, ) = LibWell.getNonBeanTokenAndIndexFromWell(beanStableWell);
        IERC20(stable).safeTransferFrom(owner, address(beanStableWell), stableAmount);
        IWell(beanStableWell).sync(address(this), 0); // sync the well.
        return IWell(beanStableWell);
    }
}
