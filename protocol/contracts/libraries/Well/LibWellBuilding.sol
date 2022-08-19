/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibWellStorage.sol";
import "./LibConstantProductWell.sol";
import "../../tokens/ERC20/WellERC20.sol";

/**
 * @author Publius
 * @title Lib Well Building
 **/
library LibWellBuilding {
    using SafeMath for uint256;

    event RegisterWellType(LibWellStorage.WellType wellType, string[] parameterTypes);
    event BuildWell(
        address wellId,
        IERC20[] tokens,
        LibWellStorage.WellType wellType,
        bytes typeData,
        bytes32 wellHash
    );
    event ModifyWell(
        address wellId,
        LibWellStorage.WellType newWellType,
        bytes newTypeData,
        bytes32 oldWellHash,
        bytes32 newWellHash
    );

    /**
     * Management
     **/

    function buildWell(
        IERC20[] calldata tokens,
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        string[] calldata symbols
    ) internal returns (address wellId) {
        checkWellValidity(tokens, wellType, typeData);
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();

        string memory name = symbols[0];
        string memory symbol = symbols[0];
        for (uint i = 1; i < tokens.length; ++i) {
            name = string(abi.encodePacked(name, ":", symbols[i]));
            symbol = string(abi.encodePacked(symbol, symbols[i]));
        }
        wellId = address(new WellERC20(name, symbol));

        LibWellStorage.WellInfo memory p;
        p.tokens = tokens;
        p.wellType = wellType;
        p.typeData = typeData;
        p.wellId = wellId;

        bytes32 ph = LibWellStorage.computeWellHash(p);

        s.indices[s.numberOfWells] = wellId;
        s.numberOfWells = s.numberOfWells.add(1);

        for (uint256 i; i < tokens.length; i++) {
            s.ps[ph].balances.push(0);
            s.ps[ph].cumulativeBalances.push(0);
        }

        s.pi[wellId] = p;
        s.ph[wellId] = ph;

        emit BuildWell(p.wellId, p.tokens, p.wellType, p.typeData, ph);
    }

    function modifyWell(
        LibWellStorage.WellInfo memory p,
        LibWellStorage.WellType newWellType,
        bytes calldata newTypeData
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        bytes32 prevPH = LibWellStorage.computeWellHash(p);
        p.wellType = newWellType;
        p.typeData = newTypeData;

        bytes32 newPH = LibWellStorage.computeWellHash(p);

        s.pi[p.wellId] = p;
        s.ph[p.wellId] = newPH;
        s.ps[newPH] = s.ps[prevPH];
        delete s.ps[prevPH];

        emit ModifyWell(p.wellId, p.wellType, p.typeData, prevPH, newPH);
    }

    function registerWellType(
        LibWellStorage.WellType newWellType,
        string[] calldata typeParameters
    ) internal {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        require(!s.wt[newWellType].registered, "LibWell: Already registered");
        s.wt[newWellType].registered = true;
        for (uint256 i; i < typeParameters.length; i++)
            s.wt[newWellType].signature.push(typeParameters[i]);
        emit RegisterWellType(newWellType, typeParameters);
    }

    /**
     * Internal
     **/

    function checkWellValidity(
        IERC20[] calldata tokens,
        LibWellStorage.WellType wellType,
        bytes calldata typeData
    ) internal pure {
        for (uint256 i; i < tokens.length - 1; i++) {
            require(
                tokens[i] < tokens[i + 1],
                "LibWell: Tokens not alphabetical"
            );
        }
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            require(
                LibConstantProductWell.isWellInfoValid(tokens, typeData),
                "LibWell: invalid well"
            );
        else revert("LibWell: Well type not supported");
    }
}
