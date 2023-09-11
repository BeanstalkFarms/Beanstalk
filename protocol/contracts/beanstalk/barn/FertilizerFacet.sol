/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IFertilizer} from "contracts/interfaces/IFertilizer.sol";
import {AppStorage} from "../AppStorage.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibEthUsdOracle} from "contracts/libraries/Oracle/LibEthUsdOracle.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {C} from "contracts/C.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";

/**
 * @author Publius
 * @title FertilizerFacet handles Minting Fertilizer and Rinsing Sprouts earned from Fertilizer.
 **/

contract FertilizerFacet {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath128 for uint128;

    event SetFertilizer(uint128 id, uint128 bpf);

    uint256 private constant FERTILIZER_AMOUNT_PRECISION = 1e24;

    AppStorage internal s;

    struct Supply {
        uint128 endBpf;
        uint256 supply;
    }


    /**
     * @notice Rinses Rinsable Sprouts earned from Fertilizer.
     * @param ids The ids of the Fertilizer to rinse.
     * @param mode The balance to transfer Beans to; see {LibTrasfer.To}
     */
    function claimFertilized(uint256[] calldata ids, LibTransfer.To mode)
        external
        payable
    {
        uint256 amount = C.fertilizer().beanstalkUpdate(msg.sender, ids, s.bpf);
        LibTransfer.sendToken(C.bean(), amount, msg.sender, mode);
    }

    /**
     * @notice Purchase Fertilizer from the Barn Raise with WETH.
     * @param wethAmountIn Amount of WETH to buy Fertilizer with 18 decimal precision.
     * @param minFertilizerOut The minimum amount of Fertilizer to purchase. Protects against a significant ETH/USD price decrease.
     * @param minLPTokensOut The minimum amount of LP tokens to receive after adding liquidity with `weth`.
     * @param mode The balance to transfer Beans to; see {LibTrasfer.To}
     * @dev The # of Fertilizer minted is equal to the value of the Ether paid in USD.
     */
    function mintFertilizer(
        uint256 wethAmountIn,
        uint256 minFertilizerOut,
        uint256 minLPTokensOut,
        LibTransfer.From mode
    ) external payable returns (uint256 fertilizerAmountOut) {

        wethAmountIn = LibTransfer.receiveToken(
            IERC20(C.WETH),
            uint256(wethAmountIn),
            msg.sender,
            mode
        ); // return value <= amount, so downcasting is safe.

        fertilizerAmountOut = getMintFertilizerOut(wethAmountIn);

        require(fertilizerAmountOut >= minFertilizerOut, "Fertilizer Not enough bought.");

        uint128 remaining = uint128(LibFertilizer.remainingRecapitalization().div(1e6)); // remaining <= 77_000_000 so downcasting is safe.
        require(fertilizerAmountOut <= remaining, "Fertilizer: Not enough remaining.");

        uint128 id = LibFertilizer.addFertilizer(
            uint128(s.season.current),
            wethAmountIn,
            fertilizerAmountOut,
            minLPTokensOut
        );
        C.fertilizer().beanstalkMint(msg.sender, uint256(id), (fertilizerAmountOut).toUint128(), s.bpf);
    }

    /**
     * @dev Callback from Fertilizer contract in `claimFertilized` function.
     */
    function payFertilizer(address account, uint256 amount) external payable {
        require(msg.sender == C.fertilizerAddress());
        LibTransfer.sendToken(
            C.bean(),
            amount,
            account,
            LibTransfer.To.INTERNAL
        );
    }

    /**
     * @dev Returns the amount of Fertilize that can be purchased with `wethAmountIn` WETH.
     * Can be used to help calculate `minFertilizerOut` in `mintFertilizer`.
     * `wethAmountIn` has 18 decimals, `getEthUsdPrice()` has 6 decimals and `fertilizerAmountOut` has 0 decimals.
     */
    function getMintFertilizerOut(
        uint256 wethAmountIn
    ) public view returns (uint256 fertilizerAmountOut) {
        fertilizerAmountOut = wethAmountIn.mul(
            LibEthUsdOracle.getEthUsdPrice()
        ).div(FERTILIZER_AMOUNT_PRECISION);
    }

    function totalFertilizedBeans() external view returns (uint256 beans) {
        return s.fertilizedIndex;
    }

    function totalUnfertilizedBeans() external view returns (uint256 beans) {
        return s.unfertilizedIndex - s.fertilizedIndex;
    }

    function totalFertilizerBeans() external view returns (uint256 beans) {
        return s.unfertilizedIndex;
    }

    function getFertilizer(uint128 id) external view returns (uint256) {
        return s.fertilizer[id];
    }

    function getNext(uint128 id) external view returns (uint128) {
        return LibFertilizer.getNext(id);
    }

    function getFirst() external view returns (uint128) {
        return s.fFirst;
    }

    function getLast() external view returns (uint128) {
        return s.fLast;
    }

    function getActiveFertilizer() external view returns (uint256) {
        return s.activeFertilizer;
    }

    function isFertilizing() external view returns (bool) {
        return s.season.fertilizing;
    }

    function beansPerFertilizer() external view returns (uint128 bpf) {
        return s.bpf;
    }

    function getHumidity(uint128 _s) external pure returns (uint128 humidity) {
        humidity = LibFertilizer.getHumidity(_s);
    }

    function getCurrentHumidity() external view returns (uint128 humidity) {
        humidity = LibFertilizer.getHumidity(s.season.current);
    }

    function getEndBpf() external view returns (uint128 endBpf) {
        endBpf = s.bpf.add(LibFertilizer.getBpf(uint128(s.season.current)));
    }

    function remainingRecapitalization() external view returns (uint256) {
        return LibFertilizer.remainingRecapitalization();
    }

    function balanceOfUnfertilized(address account, uint256[] memory ids)
        external
        view
        returns (uint256 beans)
    {
        return C.fertilizer().balanceOfUnfertilized(account, ids);
    }

    function balanceOfFertilized(address account, uint256[] memory ids)
        external
        view
        returns (uint256 beans)
    {
        return C.fertilizer().balanceOfFertilized(account, ids);
    }

    function balanceOfFertilizer(address account, uint256 id)
        external
        view
        returns (IFertilizer.Balance memory)
    {
        return C.fertilizer().lastBalanceOf(account, id);
    }

    function balanceOfBatchFertilizer(
        address[] memory accounts,
        uint256[] memory ids
    ) external view returns (IFertilizer.Balance[] memory) {
        return C.fertilizer().lastBalanceOfBatch(accounts, ids);
    }

    function getFertilizers()
        external
        view
        returns (Supply[] memory fertilizers)
    {
        uint256 numFerts = 0;
        uint128 idx = s.fFirst;
        while (idx > 0) {
            numFerts = numFerts.add(1);
            idx = LibFertilizer.getNext(idx);
        }
        fertilizers = new Supply[](numFerts);
        numFerts = 0;
        idx = s.fFirst;
        while (idx > 0) {
            fertilizers[numFerts].endBpf = idx;
            fertilizers[numFerts].supply = LibFertilizer.getAmount(idx);
            numFerts = numFerts.add(1);
            idx = LibFertilizer.getNext(idx);
        }
    }
}
