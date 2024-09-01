/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";

// Diamond setup
import {Diamond} from "contracts/beanstalk/Diamond.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {MockInitDiamond} from "contracts/mocks/newMockInitDiamond.sol";
import {InitDiamond} from "contracts/beanstalk/init/newInitDiamond.sol";
import {DiamondLoupeFacet} from "contracts/beanstalk/diamond/DiamondLoupeFacet.sol";

/// Beanstalk Contracts w/external libraries.
import {UnripeFacet, MockUnripeFacet} from "contracts/mocks/mockFacets/MockUnripeFacet.sol";
import {MockAttackFacet} from "contracts/mocks/mockFacets/MockAttackFacet.sol";
import {MockConvertFacet, ConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {MockSeasonFacet, SeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {MockSiloFacet, SiloFacet} from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import {MockPipelineConvertFacet, PipelineConvertFacet} from "contracts/mocks/mockFacets/MockPipelineConvertFacet.sol";
import {SeasonGettersFacet} from "contracts/beanstalk/sun/SeasonFacet/SeasonGettersFacet.sol";
import {DiamondCutFacet} from "contracts/beanstalk/diamond/DiamondCutFacet.sol";
import {IDiamondLoupe} from "contracts/interfaces/IDiamondLoupe.sol";

import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import "forge-std/console.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract BeanstalkDeployer is Utils {
    // add or remove facets here. Facets here do not have mocks.
    string[] facets = [
        "BDVFacet",
        "FarmFacet",
        "PauseFacet",
        "OwnershipFacet",
        "TokenFacet",
        "TokenSupportFacet",
        "GaugePointFacet",
        "LiquidityWeightFacet",
        "SiloGettersFacet",
        "ConvertGettersFacet",
        "MetadataFacet",
        "SeasonGettersFacet",
        "DepotFacet",
        "MarketplaceFacet",
        "ClaimFacet",
        "OracleFacet",
        "L1RecieverFacet"
    ];

    // Facets that have a mock counter part should be appended here.
    string[] mockFacets = [
        "FertilizerFacet", // MockFertilizerFacet
        "FieldFacet", // MockFieldFacet
        "WhitelistFacet", // MockWhitelistFacet
        "SiloFacet", // MockSiloFacet
        "UnripeFacet", // MockUnripeFacet
        "ConvertFacet", // MockConvertFacet
        "SeasonFacet", // MockSeasonFacet
        "PipelineConvertFacet" // MockPipelineConvertFacet
    ];
    address[] facetAddresses;
    string[] facetNames;

    IDiamondCut.FacetCutAction[] cutActions;

    /**
     * @notice deploys the beanstalk diamond contract.
     * @param mock if true, deploys all mocks and sets the diamond address to the canonical beanstalk address.
     */
    function setupDiamond(bool mock, bool verbose) internal returns (Diamond d) {
        users = createUsers(6);
        deployer = users[0];
        vm.label(deployer, "Deployer");
        vm.label(BEANSTALK, "Beanstalk");

        // Create cuts.
        setupFacetAddresses(mock);

        IDiamondCut.FacetCut[] memory cut = _multiCut(facets, facetAddresses, cutActions);
        d = deployDiamondAtAddress(deployer, BEANSTALK);

        // if mocking, set the diamond address to
        // the canonical beanstalk address.
        address initDiamondAddress;
        if (mock) {
            initDiamondAddress = address(new MockInitDiamond());
        } else {
            initDiamondAddress = address(new InitDiamond());
        }

        vm.prank(deployer);
        IDiamondCut(address(d)).diamondCut(
            cut,
            initDiamondAddress,
            abi.encodeWithSignature("init()")
        );

        if (verbose) console.log("Diamond deployed at: ", address(d));
    }

    function setupFacetAddresses(bool mock) internal {
        // Facets that require external libraries need to be deployed by
        // `address(new Facet())`
        // otherwise, use deployCode() to speed up test compiles.
        for (uint i; i < facets.length; i++) {
            // for facets with external libraries, deploy the facet,
            // rather than deploying using the bytecode.
            string memory facetName = facets[i];
            if (keccak256(abi.encode(facetName)) == keccak256(abi.encode("SeasonGettersFacet"))) {
                facetAddresses.push(address(new SeasonGettersFacet()));
            } else {
                console.log("deployCode facet: ", facetName);
                facetAddresses.push(address(deployCode(facetName)));
            }

            cutActions.push(IDiamondCut.FacetCutAction.Add);
            facetNames.push(facetName);
        }

        // Deploy mock only facets.
        if (mock) {
            facetAddresses.push(address(new MockAttackFacet()));
            facets.push("MockAttackFacet");
            cutActions.push(IDiamondCut.FacetCutAction.Add);
            facetNames.push("MockAttackFacet");
        }

        for (uint i; i < mockFacets.length; i++) {
            // for facets with external libraries, deploy the facet,
            // rather than deploying using the bytecode.
            string memory facet = mockFacets[i];
            // append "Mock" to the facet name.
            if (mock) facet = string(abi.encodePacked("Mock", facet));
            // Facets with an external library should be placed here.
            bytes32 hashedName = keccak256(abi.encode(mockFacets[i]));
            address facetAddress;
            if (hashedName == keccak256(abi.encode("UnripeFacet"))) {
                if (mock) {
                    facetAddress = address(new MockUnripeFacet());
                } else {
                    facetAddress = address(new UnripeFacet());
                }
            } else if (hashedName == keccak256(abi.encode("ConvertFacet"))) {
                if (mock) {
                    facetAddress = address(new MockConvertFacet());
                } else {
                    facetAddress = address(new ConvertFacet());
                }
            } else if (hashedName == keccak256(abi.encode("SeasonFacet"))) {
                if (mock) {
                    facetAddress = address(new MockSeasonFacet());
                } else {
                    facetAddress = address(new SeasonFacet());
                }
            } else if (hashedName == keccak256(abi.encode("SiloFacet"))) {
                if (mock) {
                    facetAddress = address(new MockSiloFacet());
                } else {
                    facetAddress = address(new SiloFacet());
                }
            } else if (hashedName == keccak256(abi.encode("PipelineConvertFacet"))) {
                if (mock) {
                    facetAddress = address(new MockPipelineConvertFacet());
                } else {
                    facetAddress = address(new PipelineConvertFacet());
                }
            } else {
                facetAddress = address(deployCode(facet));
            }

            facetAddresses.push(facetAddress);

            // append the facet name to the facets array.
            facets.push(facet);

            cutActions.push(IDiamondCut.FacetCutAction.Add);
            facetNames.push(facet);
        }
    }

    /**
     * @notice upgrades a diamond contract with new facets.
     * @param diamondAddress the address of the diamond contract.
     * @param newFacetNames the names of the new facets. Used to generate selectors.
     * @param newFacetAddresses the addresses of the new facets.
     * @param initAddress the address of the init diamond contract.
     * @param selectorsToRemove the selectors to remove.
     * .
     * @dev the hardhat deploy script should be used when deploying to mainnet.
     * This is used in the scope of testing.
     */
    function upgradeWithNewFacets(
        address diamondAddress,
        address diamondOwner,
        string[] memory newFacetNames,
        address[] memory newFacetAddresses,
        IDiamondCut.FacetCutAction[] memory actions,
        address initAddress,
        bytes memory initFunctionCall,
        bytes4[] memory selectorsToRemove
    ) internal {
        vm.startPrank(diamondOwner);

        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](newFacetNames.length + 1);

        // generate cut for new facets:
        cut = _multiCutWithSelectorRemovals(
            newFacetNames,
            newFacetAddresses,
            actions,
            selectorsToRemove
        );

        // call diamondcut
        IDiamondCut(diamondAddress).diamondCut(cut, initAddress, initFunctionCall);
        vm.stopPrank();
    }

    // useful for debugging which facets are erroring by adding logs to LibDiamond and deploying after forking
    function upgradeDiamondFacet() internal {
        string[] memory _facetNames = new string[](1);
        _facetNames[0] = "DiamondCutFacet";
        address[] memory newFacetAddresses = new address[](1);
        newFacetAddresses[0] = address(new DiamondCutFacet());

        IDiamondCut.FacetCutAction[] memory facetCutActions = new IDiamondCut.FacetCutAction[](1);
        facetCutActions[0] = IDiamondCut.FacetCutAction.Replace;

        // upgrade just the diamond cut facet
        upgradeWithNewFacets(
            BEANSTALK, // upgrading beanstalk.
            IMockFBeanstalk(BEANSTALK).owner(), // fetch beanstalk owner.
            _facetNames,
            newFacetAddresses,
            facetCutActions,
            address(new EmptyInitContract()), // deploy the ReseedL2Migration.
            abi.encodeWithSignature("init()"), // call init.
            new bytes4[](0)
        );
        console.log("done upgrading diamond cut facet");
    }

    /**
     * @notice Forks mainnet at a given block,
     */
    function forkMainnetAndUpgradeAllFacets() internal {
        vm.createSelectFork(vm.envString("FORKING_RPC"), 20641000);

        setupFacetAddresses(true);

        upgradeDiamondFacet();

        // the idea is to add/upgrade all the facets/mock facets that are in the constants at the top of this file
        // get the list of all current selectors
        IDiamondLoupe.Facet[] memory currentFacets = IDiamondLoupe(BEANSTALK).facets();
        bytes4[] memory currentSelectors = new bytes4[](1000);
        uint256 selectorsCounter = 0;
        for (uint256 i = 0; i < currentFacets.length; i++) {
            // loop through all selectors in the facet
            bytes4[] memory selectors = IDiamondLoupe(BEANSTALK).facetFunctionSelectors(
                currentFacets[i].facetAddress
            );
            for (uint256 j = 0; j < selectors.length; j++) {
                // add the selector to the currentSelectors array
                currentSelectors[selectorsCounter++] = selectors[j];
            }
        }
        assembly {
            mstore(currentSelectors, selectorsCounter)
        }
        // generated list of all the new selectors

        IDiamondLoupe.Facet[] memory newFacets = new IDiamondLoupe.Facet[](facetAddresses.length);

        // was goigng to originally make one large diamond cut, but kept getting EvmError: MemoryOOG
        // so instead, we make multiple diamond cuts, one for each facet
        uint256 facetAddressesLength = facetAddresses.length;

        bytes4[][] memory functionSelectorsArray = _generateMultiSelectors(facetNames);
        for (uint256 i = 0; i < facetNames.length; i++) {
            IDiamondLoupe.Facet memory facet = IDiamondLoupe.Facet(
                facetAddresses[i],
                functionSelectorsArray[i]
            );
            newFacets[i] = facet;
        }

        assembly {
            mstore(newFacets, facetAddressesLength)
        }

        // generate new Facets

        IDiamondCut.FacetCut[] memory cut = generateDiamondCut(currentFacets, newFacets);

        // log all cuts
        for (uint256 i = 0; i < cut.length; i++) {
            console.log("cut: ", cut[i].facetAddress);
            if (cut[i].action == IDiamondCut.FacetCutAction.Add) {
                console.log("action: Add");
            } else if (cut[i].action == IDiamondCut.FacetCutAction.Replace) {
                console.log("action: Replace");
            } else if (cut[i].action == IDiamondCut.FacetCutAction.Remove) {
                console.log("action: Remove");
            }
            // loop through and log cut[i].functionSelectors
            for (uint256 j = 0; j < cut[i].functionSelectors.length; j++) {
                console.log("selector: ");
                console.logBytes4(cut[i].functionSelectors[j]);
            }
        }

        vm.startPrank(IMockFBeanstalk(BEANSTALK).owner());
        IDiamondCut(BEANSTALK).diamondCut(cut, address(0), new bytes(0));
        vm.stopPrank();
    }

    //////////////////////// Deploy /////////////////////////

    /**
     * @notice deploys a diamond contract at an address.
     */
    function deployDiamondAtAddress(
        address _deployer,
        address payable beanstalkAddress
    ) internal returns (Diamond d) {
        vm.prank(_deployer);
        deployCodeTo("Diamond.sol", abi.encode(_deployer), beanstalkAddress);
        return Diamond(beanstalkAddress);
    }

    /**
     * @notice generates the diamond cut array for multiple facets.
     * @dev optimized such that ffi is only called once.
     */
    function _multiCut(
        string[] memory _facetNames,
        address[] memory _facetAddresses,
        IDiamondCut.FacetCutAction[] memory _actions
    ) internal returns (IDiamondCut.FacetCut[] memory cutArray) {
        cutArray = new IDiamondCut.FacetCut[](_facetNames.length);
        bytes4[][] memory functionSelectorsArray = _generateMultiSelectors(_facetNames);
        for (uint i; i < _facetNames.length; i++) {
            cutArray[i] = IDiamondCut.FacetCut({
                facetAddress: _facetAddresses[i],
                action: _actions[i],
                functionSelectors: functionSelectorsArray[i]
            });
        }
    }

    /**
     * @dev assumes selectors that are removed are grouped by facets.
     */
    function _multiCutWithSelectorRemovals(
        string[] memory _facetNames,
        address[] memory _facetAddresses,
        IDiamondCut.FacetCutAction[] memory actions,
        bytes4[] memory _selectorsToRemove
    ) internal returns (IDiamondCut.FacetCut[] memory cutArray) {
        // get initial cutArray.
        IDiamondCut.FacetCut[] memory initialCutArray = _multiCut(
            _facetNames,
            _facetAddresses,
            actions
        );

        // generate cuts for selectors to remove.
        if (_selectorsToRemove.length != 0) {
            cutArray = new IDiamondCut.FacetCut[](initialCutArray.length + 1);
            cutArray[0] = IDiamondCut.FacetCut(
                address(0),
                IDiamondCut.FacetCutAction.Remove,
                _selectorsToRemove
            );

            for (uint i; i < initialCutArray.length; i++) {
                cutArray[i + 1] = initialCutArray[i];
            }
        } else {
            cutArray = initialCutArray;
        }
    }

    /**
     * @notice generates the selectors for multiple facets.
     * @dev optimized such that ffi is only called once to
     * optimize on compile time.
     */
    function _generateMultiSelectors(
        string[] memory _facetNames
    ) internal returns (bytes4[][] memory selectorsArray) {
        string[] memory cmd = new string[](_facetNames.length + 2);
        cmd[0] = "node";
        cmd[1] = "scripts/genSelectors.js";
        for (uint i = 0; i < _facetNames.length; i++) {
            cmd[i + 2] = _facetNames[i];
        }
        bytes memory res = vm.ffi(cmd);
        console.log("got command back");
        // log bytes length
        console.log("res length: ", res.length);
        selectorsArray = abi.decode(res, (bytes4[][]));
        console.log("decoded");
    }

    function generateDiamondCut(
        IDiamondLoupe.Facet[] memory _existingFacets,
        IDiamondLoupe.Facet[] memory _newFacets
    ) internal returns (IDiamondCut.FacetCut[] memory) {
        // Encode the existing facets
        string memory existingFacetsJson = _encodeFacetsToJson(_existingFacets);

        // Encode the new facets
        string memory newFacetsJson = _encodeFacetsToJson(_newFacets);

        // Prepare the command to run the Node.js script
        string[] memory cmd = new string[](4);
        cmd[0] = "node";
        cmd[1] = "scripts/genDiamondCut.js";
        cmd[2] = existingFacetsJson;
        cmd[3] = newFacetsJson;

        // Run the script and get the result
        bytes memory res = vm.ffi(cmd);
        console.log("Diamond cut generated");

        // Decode the result
        IDiamondCut.FacetCut[] memory diamondCut = abi.decode(res, (IDiamondCut.FacetCut[]));
        console.log("Diamond cut decoded");

        return diamondCut;
    }

    function _encodeFacetsToJson(
        IDiamondLoupe.Facet[] memory _facets
    ) internal pure returns (string memory) {
        string memory json = "[";
        for (uint i = 0; i < _facets.length; i++) {
            if (i > 0) json = string(abi.encodePacked(json, ","));
            json = string(
                abi.encodePacked(
                    json,
                    '{"facetAddress":"',
                    _addressToString(_facets[i].facetAddress),
                    '","selectors":['
                )
            );
            for (uint j = 0; j < _facets[i].functionSelectors.length; j++) {
                if (j > 0) json = string(abi.encodePacked(json, ","));
                json = string(
                    abi.encodePacked(
                        json,
                        '"',
                        _bytes4ToString(_facets[i].functionSelectors[j]),
                        '"'
                    )
                );
            }
            json = string(abi.encodePacked(json, "]}"));
        }
        json = string(abi.encodePacked(json, "]"));
        return json;
    }

    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0";
        s[1] = "x";
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(_addr)) / (2 ** (8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 + 2 * i] = _char(hi);
            s[2 + 2 * i + 1] = _char(lo);
        }
        return string(s);
    }

    function _bytes4ToString(bytes4 _bytes) internal pure returns (string memory) {
        bytes memory s = new bytes(10);
        s[0] = "0";
        s[1] = "x";
        for (uint i = 0; i < 4; i++) {
            bytes1 b = _bytes[i];
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 + 2 * i] = _char(hi);
            s[2 + 2 * i + 1] = _char(lo);
        }
        return string(s);
    }

    function _char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}

contract EmptyInitContract {
    function init() external {}
}
