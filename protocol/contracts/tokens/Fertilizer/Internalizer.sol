// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Fertilizer1155.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "contracts/libraries/LibSafeMath128.sol";
import "./FertilizerImage.sol";
import {LibBytes64} from "contracts/libraries/LibBytes64.sol";

/**
 * @author publius, deadmanwalking
 * @title Fertilizer before the Unpause
 */

// interface to interact with the Beanstalk contract
interface IBeanstalk {
    function payFertilizer(address account, uint256 amount) external;
    function beansPerFertilizer() external view returns (uint128);
    function getEndBpf() external view returns (uint128);
    function remainingRecapitalization() external view returns (uint256);
    function getFertilizer(uint128) external view returns (uint256);
}

contract Internalizer is OwnableUpgradeable, ReentrancyGuardUpgradeable, Fertilizer1155, FertilizerImage {

    using SafeERC20Upgradeable for IERC20;
    using LibSafeMath128 for uint128;
    using LibStrings for uint256;

    struct Balance {
        uint128 amount;
        uint128 lastBpf;
    }

    function __Internallize_init(string memory uri_) internal {
        __Ownable_init();
        __ERC1155_init(uri_);
        __ReentrancyGuard_init();
    }

    mapping(uint256 => mapping(address => Balance)) internal _balances;

    string private _uri;

    ///////////////////// NEW URI FUNCTION ///////////////////////

    /**
     * @notice Assembles and returns a base64 encoded json metadata
     * URI for a given fertilizer ID.
     * Need to override because the contract indirectly
     * inherits from ERC1155.
     * @param _id - the id of the fertilizer
     * @return - the json metadata URI
     */
    function uri(uint256 _id)
        external
        view
        virtual
        override 
        returns (string memory)
    {

        uint128 bpfRemaining = calculateBpfRemaining(_id);

        // generate the image URI
        string memory imageUri = imageURI(_id , bpfRemaining);

        // assemble and return the json URI
        return (
            string(
                abi.encodePacked(
                    BASE_JSON_URI,
                    LibBytes64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name": "Fertilizer - ',
                                _id.toString(),
                                '", "external_url": "https://fert.bean.money/',
                                _id.toString(),
                                '.html", ',
                                '"description": "A trusty constituent of any Farmers toolbox, ERC-1155 FERT has been known to spur new growth on seemingly dead farms. Once purchased and deployed into fertile ground by Farmers, Fertilizer generates new Sprouts: future Beans yet to be repaid by Beanstalk in exchange for doing the work of Replanting the protocol.", "image": "',
                                imageUri,
                                '", "attributes": [{ "trait_type": "BPF Remaining","display_type": "boost_number","value": ',
                                LibStrings.formatUintWith6DecimalsTo2(bpfRemaining),
                                " }]}"
                            )
                        )
                    )
                )
            )
        );
    }

    /**
     * @notice Returns the beans per fertilizer remaining for a given fertilizer Id.
     * @param id - the id of the fertilizer
     * Formula: bpfRemaining = id - s.bpf
     * Calculated here to avoid uint underflow 
     * Solidity 0.8.0 has underflow protection and the tx would revert but we are using 0.7.6
     */
    function calculateBpfRemaining(uint256 id) internal view returns (uint128) {
        // make sure it does not underflow
        if (uint128(id) >= IBeanstalk(BEANSTALK).beansPerFertilizer()) {
            return uint128(id) - IBeanstalk(BEANSTALK).beansPerFertilizer() ;
        } else {
            return 0;
        }
    } 

    function name() external pure returns (string memory) {
        return "Fertilizer";
    }

    function symbol() external pure returns (string memory) {
        return "FERT";
    }

    function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][account].amount;
    }

    function lastBalanceOf(address account, uint256 id) public view returns (Balance memory) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][account];
    }

    function lastBalanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (Balance[] memory balances) {
        balances = new Balance[](accounts.length);
        for (uint256 i; i < accounts.length; ++i) {
            balances[i] = lastBalanceOf(accounts[i], ids[i]);
        }
    }

    function _transfer(
        address from,
        address to,
        uint256 id,
        uint256 amount
    ) internal virtual override {
        uint128 _amount = uint128(amount);
        if (from != address(0)) {
            uint128 fromBalance = _balances[id][from].amount;
            require(uint256(fromBalance) >= amount, "ERC1155: insufficient balance for transfer");
            // Because we know fromBalance >= amount, we know amount < type(uint128).max
            _balances[id][from].amount = fromBalance - _amount;
        }
        _balances[id][to].amount = _balances[id][to].amount.add(_amount);
    }
}