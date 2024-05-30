/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "../storage/AppStorage.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {IFertilizer} from "contracts/interfaces/IFertilizer.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibRedundantMath128} from "contracts/libraries/LibRedundantMath128.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";

/**
 * @author Publius
 * @title FertilizerFacet handles Minting Fertilizer and Rinsing Sprouts earned from Fertilizer.
 **/

contract FertilizerFacet is Invariable {
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;
    using LibRedundantMath128 for uint128;

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
    function claimFertilized(
        uint256[] calldata ids,
        LibTransfer.To mode
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        uint256 amount = C.fertilizer().beanstalkUpdate(LibTractor._user(), ids, s.sys.fert.bpf);
        s.sys.fert.fertilizedPaidIndex += amount;
        LibTransfer.sendToken(C.bean(), amount, LibTractor._user(), mode);
    }

    /**
     * @notice Purchase Fertilizer from the Barn Raise with the Barn Raise token.
     * @param tokenAmountIn Amount of tokens to buy Fertilizer with 18 decimal precision.
     * @param minFertilizerOut The minimum amount of Fertilizer to purchase. Protects against a significant Barn Raise Token/USD price decrease.
     * @param minLPTokensOut The minimum amount of LP tokens to receive after adding liquidity with Barn Raise tokens.
     * @dev The # of Fertilizer minted is equal to the value of the Ether paid in USD.
     */
    function mintFertilizer(
        uint256 tokenAmountIn,
        uint256 minFertilizerOut,
        uint256 minLPTokensOut
    ) external payable fundsSafu noOutFlow returns (uint256 fertilizerAmountOut) {
        fertilizerAmountOut = _getMintFertilizerOut(
            tokenAmountIn,
            LibBarnRaise.getBarnRaiseToken()
        );

        require(fertilizerAmountOut >= minFertilizerOut, "Fertilizer: Not enough bought.");
        require(fertilizerAmountOut > 0, "Fertilizer: None bought.");

        uint128 remaining = uint128(LibFertilizer.remainingRecapitalization().div(1e6)); // remaining <= 77_000_000 so downcasting is safe.
        require(fertilizerAmountOut <= remaining, "Fertilizer: Not enough remaining.");

        uint128 id = LibFertilizer.addFertilizer(
            uint128(s.sys.season.current),
            tokenAmountIn,
            fertilizerAmountOut,
            minLPTokensOut
        );
        C.fertilizer().beanstalkMint(
            LibTractor._user(),
            uint256(id),
            (fertilizerAmountOut).toUint128(),
            s.sys.fert.bpf
        );
    }

    /**
     * @dev Callback from Fertilizer contract in `claimFertilized` function.
     */
    function payFertilizer(
        address account,
        uint256 amount
    ) external payable fundsSafu noSupplyChange oneOutFlow(C.BEAN) {
        require(msg.sender == C.fertilizerAddress());
        s.sys.fert.fertilizedPaidIndex += amount;
        LibTransfer.sendToken(C.bean(), amount, account, LibTransfer.To.INTERNAL);
    }

    /**
     * @dev Returns the amount of Fertilizer that can be purchased with `tokenAmountIn` Barn Raise tokens.
     * Can be used to help calculate `minFertilizerOut` in `mintFertilizer`.
     * `tokenAmountIn` has 18 decimals, `getEthUsdPrice()` has 6 decimals and `fertilizerAmountOut` has 0 decimals.
     */
    function getMintFertilizerOut(
        uint256 tokenAmountIn
    ) external view returns (uint256 fertilizerAmountOut) {
        address barnRaiseToken = LibBarnRaise.getBarnRaiseToken();
        return _getMintFertilizerOut(tokenAmountIn, barnRaiseToken);
    }

    function _getMintFertilizerOut(
        uint256 tokenAmountIn,
        address barnRaiseToken
    ) public view returns (uint256 fertilizerAmountOut) {
        fertilizerAmountOut = tokenAmountIn.div(LibUsdOracle.getUsdPrice(barnRaiseToken));
    }

    function totalFertilizedBeans() external view returns (uint256 beans) {
        return s.sys.fert.fertilizedIndex;
    }

    function totalUnfertilizedBeans() external view returns (uint256 beans) {
        return s.sys.fert.unfertilizedIndex - s.sys.fert.fertilizedIndex;
    }

    function totalFertilizerBeans() external view returns (uint256 beans) {
        return s.sys.fert.unfertilizedIndex;
    }

    function leftoverBeans() external view returns (uint256) {
        return s.sys.fert.leftoverBeans;
    }

    function getFertilizer(uint128 id) external view returns (uint256) {
        return s.sys.fert.fertilizer[id];
    }

    function getNext(uint128 id) external view returns (uint128) {
        return LibFertilizer.getNext(id);
    }

    function getFirst() external view returns (uint128) {
        return s.sys.fert.fertFirst;
    }

    function getLast() external view returns (uint128) {
        return s.sys.fert.fertLast;
    }

    function getActiveFertilizer() external view returns (uint256) {
        return s.sys.fert.activeFertilizer;
    }

    function isFertilizing() external view returns (bool) {
        return s.sys.season.fertilizing;
    }

    function beansPerFertilizer() external view returns (uint128 bpf) {
        return s.sys.fert.bpf;
    }

    function getHumidity(uint128 _s) external pure returns (uint128 humidity) {
        humidity = LibFertilizer.getHumidity(_s);
    }

    function getCurrentHumidity() external view returns (uint128 humidity) {
        humidity = LibFertilizer.getHumidity(s.sys.season.current);
    }

    function getEndBpf() external view returns (uint128 endBpf) {
        endBpf = s.sys.fert.bpf.add(LibFertilizer.getBpf(uint128(s.sys.season.current)));
    }

    function remainingRecapitalization() external view returns (uint256) {
        return LibFertilizer.remainingRecapitalization();
    }

    function balanceOfUnfertilized(
        address account,
        uint256[] memory ids
    ) external view returns (uint256 beans) {
        return C.fertilizer().balanceOfUnfertilized(account, ids);
    }

    function balanceOfFertilized(
        address account,
        uint256[] memory ids
    ) external view returns (uint256 beans) {
        return C.fertilizer().balanceOfFertilized(account, ids);
    }

    function balanceOfFertilizer(
        address account,
        uint256 id
    ) external view returns (IFertilizer.Balance memory) {
        return C.fertilizer().lastBalanceOf(account, id);
    }

    function balanceOfBatchFertilizer(
        address[] memory accounts,
        uint256[] memory ids
    ) external view returns (IFertilizer.Balance[] memory) {
        return C.fertilizer().lastBalanceOfBatch(accounts, ids);
    }

    function getFertilizers() external view returns (Supply[] memory fertilizers) {
        uint256 numFerts = 0;
        uint128 idx = s.sys.fert.fertFirst;
        while (idx > 0) {
            numFerts = numFerts.add(1);
            idx = LibFertilizer.getNext(idx);
        }
        fertilizers = new Supply[](numFerts);
        numFerts = 0;
        idx = s.sys.fert.fertFirst;
        while (idx > 0) {
            fertilizers[numFerts].endBpf = idx;
            fertilizers[numFerts].supply = LibFertilizer.getAmount(idx);
            numFerts = numFerts.add(1);
            idx = LibFertilizer.getNext(idx);
        }
    }

    function getBarnRaiseWell() external view returns (address) {
        return LibBarnRaise.getBarnRaiseWell();
    }

    function getBarnRaiseToken() external view returns (address) {
        return LibBarnRaise.getBarnRaiseToken();
    }

    /**
     * @notice Begins the process of Migration the Barn Raise to a new Well.
     * @param well The address of the Well to migrate to.
     * @dev
     * Withdraws all underlying Unripe LP tokens to the owner contract.
     * Converting, chopping and purchasing Fertilizer will be disabled until the migration is complete.
     * The migration process is completed by calling {UnripeFacet.addMigratedUnderlying}.
     * After migration, Unripe liquidity will be added into `well`. and Fertilizer purchases can only happen
     * with the non-Bean token in `well`.
     *
     */
    function beginBarnRaiseMigration(address well) external {
        LibDiamond.enforceIsOwnerOrContract();
        LibFertilizer.beginBarnRaiseMigration(well);
    }
}
