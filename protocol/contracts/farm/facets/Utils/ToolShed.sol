/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {Storage} from "../../AppStorage.sol";
import "../../../interfaces/IBean.sol";

/**
 * @author LeoFib
 * @title ToolShed holds all the util helper functions and constants for Beanstalk
**/
contract ToolShed {
    
    uint8 index = 1;
    // Token addresses
    address private constant UNISWAP_PAIR_ADDRESS = address(0x87898263B6C5BABe34b4ec53F22d98430b91e371);
    address private constant BEAN_ADDRESS = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    address private constant PEG_PAIR_ADDRESS = address(0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc);
    
    /**
     * Getters
    **/

    function getUniswapPairAddress() internal pure returns (address) {
        return UNISWAP_PAIR_ADDRESS;
    }

    function getBeanAddress() internal pure returns (address) {
        return BEAN_ADDRESS;
    }

    function getPegPairAddress() internal pure returns (address) {
        return PEG_PAIR_ADDRESS;
    }

    function bean() internal virtual returns (IBean) {
        return IBean(BEAN_ADDRESS);
    }

    function pair() internal pure returns (IUniswapV2Pair) {
        return IUniswapV2Pair(UNISWAP_PAIR_ADDRESS);
    }

    function pegPair() internal pure returns (IUniswapV2Pair) {
        return IUniswapV2Pair(PEG_PAIR_ADDRESS);
    }
    
    // (ethereum, beans)
    function reserves() internal view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return (index == 0 ? reserve1 : reserve0,index == 0 ? reserve0 : reserve1);
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
    * Update Settings Struct Functions
    **/

    function defaultSettings() internal returns (Storage.Settings memory set) {
        Storage.Settings memory DEFAULT_SETTINGS;
        DEFAULT_SETTINGS.toInternalBalance = false;
        DEFAULT_SETTINGS.fromInternalBalance = false;
        DEFAULT_SETTINGS.lightUpdateSilo = false;
        return DEFAULT_SETTINGS;
    }

}