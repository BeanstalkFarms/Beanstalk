/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../tokens/ERC20/WellToken.sol";
import "./LibWellFunction.sol";
import "./LibWellBalance.sol";
import "./LibWellTokens.sol";
import "./Pump/LibPump.sol";


/**
 * @author Publius
 * @title Lib Well Building
 **/
library LibWellBuilding {
    using SafeMath for uint256;

    event BuildWell(
        address wellId,
        bytes wellFunction,
        IERC20[] tokens,
        bytes decimalData,
        bytes[] pumps,
        bytes32 wellHash
    );

    event ModifyWell(
        address wellId,
        bytes wellFunction,
        bytes32 oldWellHash,
        bytes32 newWellHash
    );

    /**
     * Management
     **/

    function buildWell(
        bytes calldata wellFunction,
        IERC20[] calldata tokens,
        string[] calldata symbols,
        uint8[] calldata decimals,
        bytes[] calldata pumps
    ) internal returns (LibWellStorage.WellInfo memory w) {
        checkIfWellValid(tokens, wellFunction);
        require(tokens.length == symbols.length && tokens.length == decimals.length, "LibWell: arrays different lengths");
        require(tokens.length < 9, "LibWell: 8 Tokens max");

        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();

        w.wellFunction = wellFunction;
        w.tokens = tokens;
        w.decimalData = LibWellTokens.encodeDecimalData(decimals);

        for (uint i; i < pumps.length; ++i) {
            require(uint8(pumps[i][1]) == tokens.length, "Pump: Wrong number of tokens.");
        }

        w.pumps = pumps;
        // Compute Salt for LP Token Deployment (Without Well Id being set)
        w.wellId = deployWellToken(symbols, LibWellStorage.computeWellHash(w));

        s.wi[w.wellId] = w;
        s.wh[w.wellId] = LibWellStorage.computeWellHash(w);

        s.indices[s.numberOfWells] = w.wellId;
        s.numberOfWells = s.numberOfWells.add(1);

        LibPump.updateLastBlockNumber(s.wh[w.wellId], tokens.length);

        emit BuildWell(w.wellId, wellFunction, tokens, w.decimalData, pumps, s.wh[w.wellId]);
    }

    function deployWellToken(
        string[] calldata symbols,
        bytes32 wh
    ) private returns (address wellId) {
        string memory name = symbols[0];
        string memory symbol = symbols[0];
        for (uint i = 1; i < symbols.length; ++i) {
            name = string(abi.encodePacked(name, ":", symbols[i]));
            symbol = string(abi.encodePacked(symbol, symbols[i]));
        }
        wellId = address(new WellToken{salt: wh}(name, symbol));

    }

    function modifyWellFunction(
        LibWellStorage.WellInfo calldata w,
        bytes calldata newWellFunction
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        LibWellStorage.WellInfo memory newW = w;
        newW.wellFunction = newWellFunction;
    
        bytes32 prevWH = LibWellStorage.computeWellHash(w);
        bytes32 newWH = LibWellStorage.computeWellHash(newW);

        s.wi[newW.wellId] = newW;
        s.wh[newW.wellId] = newWH;

        LibWellBalance.migrateBalances(prevWH, newWH, w.tokens.length);

        emit ModifyWell(w.wellId, newWellFunction, prevWH, newWH);
    }

    /**
     * Internal
    **/

    function checkIfWellValid(
        IERC20[] calldata tokens,
        bytes calldata wellFunction
    ) internal view {
        uint128[] memory balances = new uint128[](tokens.length);
        for (uint256 i; i < tokens.length - 1; i++) {
            require(
                tokens[i] < tokens[i + 1],
                "LibWell: Tokens not alphabetical"
            );
            balances[i] = 1;
        }
        balances[tokens.length-1] = 1;

        uint256 d = LibWellFunction.getD(wellFunction, balances);
        LibWellFunction.getX(wellFunction, balances, 0, d);
    }
}
