/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import {C} from "contracts/C.sol";
import "../../../contracts/libraries/Oracle/LibWstethEthOracle.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibUsdOracle} from "../../../contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibChainlinkOracle} from "../../../contracts/libraries/Oracle/LibChainlinkOracle.sol";

contract Diamond {
    AppStorage internal s;
}

contract PriceTesterWstethETH is Diamond, Test {
    address constant USDC_USD_CHAINLINK_PRICE_AGGREGATOR =
        address(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);

    function testForkPriceWithTimeout() public {
        vm.createSelectFork(vm.envString("FORKING_RPC"), 20008200);
        Implementation memory impl = Implementation({
            target: USDC_USD_CHAINLINK_PRICE_AGGREGATOR,
            selector: bytes4(0),
            encodeType: bytes1(0x01),
            timeout: LibChainlinkOracle.FOUR_DAY_TIMEOUT
        });
        s.sys.oracleImplementation[C.USDC] = impl;
        uint price = LibUsdOracle.getUsdPrice(C.USDC);
        assertGt(price, 0, "price should be greater than 0 on block 20008200");

        vm.createSelectFork(vm.envString("FORKING_RPC"), 20253304 + 5);

        price = LibUsdOracle.getUsdPrice(C.USDC);
        assertGt(price, 0, "price should be greater than 0 on block 20253304 + 5");

        // revert back to this block, use 4 hour timeout, should return price of 0
        vm.createSelectFork(vm.envString("FORKING_RPC"), 20008200);

        impl = Implementation({
            target: USDC_USD_CHAINLINK_PRICE_AGGREGATOR,
            selector: bytes4(0),
            encodeType: bytes1(0x01),
            timeout: LibChainlinkOracle.FOUR_HOUR_TIMEOUT
        });
        s.sys.oracleImplementation[C.USDC] = impl;

        price = LibUsdOracle.getUsdPrice(C.USDC);
        assertEq(price, 0, "price should be 0 on block 20008200");
    }
}
