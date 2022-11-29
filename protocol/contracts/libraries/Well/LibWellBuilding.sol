/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../tokens/ERC20/WellToken.sol";
import "./Type/LibWellType.sol";
import "./LibWellBalance.sol";
import "./LibWellData.sol";
import "./Pump/LibPump.sol";


/**
 * @author Publius
 * @title Lib Well Building
 **/
library LibWellBuilding {
    using SafeMath for uint256;

    event BuildWell(
        address wellId,
        IERC20[] tokens,
        LibWellType.WellType wellType,
        bytes typeData,
        bytes[] pumps,
        bytes encodedData,
        bytes32 wellHash
    );

    event ModifyWell(
        address wellId,
        LibWellType.WellType newWellType,
        bytes newTypeData,
        bytes32 oldWellHash,
        bytes32 newWellHash
    );

    /**
     * Management
     **/

    function buildWell(
        IERC20[] calldata tokens,
        LibWellType.WellType wellType,
        bytes calldata typeData,
        bytes[] calldata pumps,
        string[] calldata symbols,
        uint8[] calldata decimals
    ) internal returns (LibWellStorage.WellInfo memory w) {
        require(isWellValid(tokens, wellType, typeData), "LibWell: Well not valid.");
        require(tokens.length == symbols.length && tokens.length == decimals.length, "LibWell: arrays different lengths");
        require(tokens.length < 9, "LibWell: 8 Tokens max");

        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();

        LibWellType.registerIfNeeded(wellType);

        w.tokens = tokens;
        w.data = LibWellData.encodeData(wellType, uint8(w.tokens.length), decimals, typeData);

        for (uint i; i < pumps.length; ++i) {
            require(uint8(pumps[i][1]) == tokens.length, "Pump: Wrong number of tokens.");
        }

        w.pumps = pumps;
        // Compute Salt for LP Token Deployment (Without Well Id being set)
        w.wellId = deployWellToken(symbols, LibWellStorage.computeWellHash(w));

        s.wi[w.wellId] = w;
        s.wh[w.wellId] = LibWellStorage.computeWellHash(w);

        emit BuildWell(w.wellId, tokens, wellType, typeData, pumps, w.data, s.wh[w.wellId]);

        s.indices[s.numberOfWells] = w.wellId;
        s.numberOfWells = s.numberOfWells.add(1);

        LibPump.updateLastBlockNumber(s.wh[w.wellId], tokens.length);
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

    function modifyWell(
        LibWellStorage.WellInfo calldata w,
        LibWellType.WellType newWellType,
        bytes calldata newTypeData
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        LibWellStorage.WellInfo memory newW = w;
        newW.data = LibWellData.encodeData(newWellType, uint8(w.tokens.length), LibWellData.getDecimals(w.data), newTypeData);
    
        bytes32 prevWH = LibWellStorage.computeWellHash(w);
        bytes32 newWH = LibWellStorage.computeWellHash(newW);

        s.wi[newW.wellId] = newW;
        s.wh[newW.wellId] = newWH;

        LibWellBalance.migrateBalances(prevWH, newWH, w.tokens.length);

        emit ModifyWell(w.wellId, newWellType, newTypeData, prevWH, newWH);
    }

    /**
     * Internal
     **/

    function isWellValid(
        IERC20[] calldata tokens,
        LibWellType.WellType wellType,
        bytes calldata typeData
    ) internal pure returns (bool) {
        for (uint256 i; i < tokens.length - 1; i++) {
            require(
                tokens[i] < tokens[i + 1],
                "LibWell: Tokens not alphabetical"
            );
        }
        if (wellType == LibWellType.WellType.CONSTANT_PRODUCT) 
            return typeData.length == 0;
        else revert("LibWell: Well type not supported");
    }
}
