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
import {MockFertilizerFacet, FertilizerFacet} from "contracts/mocks/mockFacets/MockFertilizerFacet.sol";
import {MockWhitelistFacet, WhitelistFacet} from "contracts/mocks/mockFacets/MockWhitelistFacet.sol";
import {MockFieldFacet, FieldFacet} from "contracts/mocks/mockFacets/MockFieldFacet.sol";
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
        "PipelineConvertFacet", // MockPipelineConvertFacet
        "SeasonGettersFacet" // MockSeasonGettersFacet
    ];
    address[] initialDeployFacetAddresses;
    string[] initialDeploFacetNames;
    address[] upgradeFacetAddresses;
    string[] upgradeFacetNames;

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
        setupFacetAddresses(mock, true, false);

        IDiamondCut.FacetCut[] memory cut = _multiCut(
            initialDeploFacetNames,
            initialDeployFacetAddresses,
            cutActions
        );
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

    function setupFacetAddresses(bool mock, bool attack, bool includeUpgradeFacetsOnly) internal {
        address[] memory facetAddresses = new address[](100);
        string[] memory facetNames = new string[](100);

        uint256 facetCounter;

        // Facets that require external libraries need to be deployed by
        // `address(new Facet())`
        // otherwise, use deployCode() to speed up test compiles.
        for (uint i; i < facets.length; i++) {
            // for facets with external libraries, deploy the facet,
            // rather than deploying using the bytecode.
            string memory facetName = facets[i];

            if (
                includeUpgradeFacetsOnly &&
                (keccak256(abi.encodePacked(facetName)) ==
                    keccak256(abi.encodePacked("OwnershipFacet")) ||
                    keccak256(abi.encodePacked(facetName)) ==
                    keccak256(abi.encodePacked("PauseFacet")) ||
                    keccak256(abi.encodePacked(facetName)) ==
                    keccak256(abi.encodePacked("DiamondCutFacet")) ||
                    keccak256(abi.encodePacked(facetName)) ==
                    keccak256(abi.encodePacked("DiamondCutFacet")))
            ) {
                continue;
            }

            if (keccak256(abi.encode(facetName)) == keccak256(abi.encode("SeasonGettersFacet"))) {
                facetAddresses[facetCounter++] = address(new SeasonGettersFacet());
            } else {
                facetAddresses[facetCounter++] = address(deployCode(facetName));
            }

            cutActions.push(IDiamondCut.FacetCutAction.Add);
            // facetNames.push(facetName);
            facetNames[facetCounter - 1] = facetName;
        }

        // Deploy mock only facets.
        if (mock && attack) {
            // facetAddresses.push(address(new MockAttackFacet()));
            facetAddresses[facetCounter++] = address(new MockAttackFacet());
            cutActions.push(IDiamondCut.FacetCutAction.Add);
            facetNames[facetCounter - 1] = "MockAttackFacet";
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
            } else if (hashedName == keccak256(abi.encode("FertilizerFacet"))) {
                if (mock) {
                    facetAddress = address(new MockFertilizerFacet());
                } else {
                    facetAddress = address(new FertilizerFacet());
                }
            } else if (hashedName == keccak256(abi.encode("WhitelistFacet"))) {
                if (mock) {
                    facetAddress = address(new MockWhitelistFacet());
                } else {
                    facetAddress = address(new WhitelistFacet());
                }
            } else if (hashedName == keccak256(abi.encode("FieldFacet"))) {
                if (mock) {
                    facetAddress = address(new MockFieldFacet());
                } else {
                    facetAddress = address(new FieldFacet());
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

            facetAddresses[facetCounter++] = facetAddress;

            cutActions.push(IDiamondCut.FacetCutAction.Add);
            facetNames[facetCounter - 1] = facet;
        }

        // update array lengths
        assembly {
            mstore(facetAddresses, facetCounter)
            mstore(facetNames, facetCounter)
        }

        if (includeUpgradeFacetsOnly) {
            upgradeFacetAddresses = facetAddresses;
            upgradeFacetNames = facetNames;
        } else {
            initialDeployFacetAddresses = facetAddresses;
            initialDeploFacetNames = facetNames;
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
    /*function upgradeDiamondFacet() internal {
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
    }*/

    /**
     * @notice Forks mainnet at a given block,
     */
    function forkMainnetAndUpgradeAllFacets(uint256 blockNumber) internal {
        vm.createSelectFork(vm.envString("FORKING_RPC"), blockNumber);

        setupFacetAddresses(true, false, true);

        // upgradeDiamondFacet();

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

        // generated list of all the new facets
        IDiamondLoupe.Facet[] memory newFacets = new IDiamondLoupe.Facet[](
            upgradeFacetAddresses.length
        );

        uint256 facetAddressesLength = upgradeFacetAddresses.length;

        bytes4[][] memory functionSelectorsArray = _generateMultiSelectors(upgradeFacetNames);
        for (uint256 i = 0; i < upgradeFacetNames.length; i++) {
            IDiamondLoupe.Facet memory facet = IDiamondLoupe.Facet(
                upgradeFacetAddresses[i],
                functionSelectorsArray[i]
            );
            newFacets[i] = facet;
        }

        assembly {
            mstore(newFacets, facetAddressesLength)
        }

        // generate the diamond cut required to upgrade all facets
        IDiamondCut.FacetCut[] memory cut = generateDiamondCut(currentFacets, newFacets);

        vm.startPrank(IMockFBeanstalk(BEANSTALK).owner());
        // perform the diamond cut (upgrades Beanstalk)
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
        // be aware of cases where the response may be very large, which can break the EVM
        bytes memory res = vm.ffi(cmd);

        if (res.length > 0) {
            selectorsArray = _decodeCompactSelectors(res);
        } else {
            selectorsArray = new bytes4[][](0);
        }
    }

    function _decodeCompactSelectors(bytes memory data) internal pure returns (bytes4[][] memory) {
        uint256 pointer = 0;
        uint256 numContracts = uint256(bytes32(slice(data, pointer, 32)));
        pointer += 32;

        bytes4[][] memory selectorsArray = new bytes4[][](numContracts);

        for (uint256 i = 0; i < numContracts; i++) {
            uint16 numSelectors = uint16(bytes2(slice(data, pointer, 2)));
            pointer += 2;

            bytes4[] memory selectors = new bytes4[](numSelectors);
            for (uint256 j = 0; j < numSelectors; j++) {
                selectors[j] = bytes4(slice(data, pointer, 4));
                pointer += 4;
            }

            selectorsArray[i] = selectors;
        }

        return selectorsArray;
    }

    function generateDiamondCut(
        IDiamondLoupe.Facet[] memory currentFacets,
        IDiamondLoupe.Facet[] memory newFacets
    ) internal pure returns (IDiamondCut.FacetCut[] memory) {
        // Use a dynamic array for cuts
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](0);

        // Create arrays to store all selectors and their corresponding new facet addresses
        bytes4[] memory allSelectors = new bytes4[](0);
        address[] memory allNewFacetAddresses = new address[](0);

        // Populate the arrays with data from newFacets
        for (uint256 i = 0; i < newFacets.length; i++) {
            for (uint256 j = 0; j < newFacets[i].functionSelectors.length; j++) {
                allSelectors = appendToBytes4Array(allSelectors, newFacets[i].functionSelectors[j]);
                allNewFacetAddresses = appendToAddressArray(
                    allNewFacetAddresses,
                    newFacets[i].facetAddress
                );
            }
        }

        // Process removals and replacements
        for (uint256 i = 0; i < currentFacets.length; i++) {
            bytes4[] memory selectorsToRemove = new bytes4[](
                currentFacets[i].functionSelectors.length
            );
            bytes4[] memory selectorsToReplace = new bytes4[](
                currentFacets[i].functionSelectors.length
            );
            uint256 removeCount = 0;
            uint256 replaceCount = 0;

            for (uint256 j = 0; j < currentFacets[i].functionSelectors.length; j++) {
                bytes4 selector = currentFacets[i].functionSelectors[j];
                (bool found, address newFacetAddress) = findNewFacetAddress(
                    selector,
                    allSelectors,
                    allNewFacetAddresses
                );

                if (!found) {
                    selectorsToRemove[removeCount] = selector;
                    removeCount++;
                } else if (newFacetAddress != currentFacets[i].facetAddress) {
                    selectorsToReplace[replaceCount] = selector;
                    replaceCount++;
                }
            }

            if (removeCount > 0) {
                bytes4[] memory finalSelectorsToRemove = new bytes4[](removeCount);
                for (uint256 j = 0; j < removeCount; j++) {
                    finalSelectorsToRemove[j] = selectorsToRemove[j];
                }
                cuts = appendToCuts(
                    cuts,
                    IDiamondCut.FacetCut(
                        address(0),
                        IDiamondCut.FacetCutAction.Remove,
                        finalSelectorsToRemove
                    )
                );
            }

            if (replaceCount > 0) {
                bytes4[] memory finalSelectorsToReplace = new bytes4[](replaceCount);
                for (uint256 j = 0; j < replaceCount; j++) {
                    finalSelectorsToReplace[j] = selectorsToReplace[j];
                }
                (, address newFacetAddress) = findNewFacetAddress(
                    finalSelectorsToReplace[0],
                    allSelectors,
                    allNewFacetAddresses
                );
                cuts = appendToCuts(
                    cuts,
                    IDiamondCut.FacetCut(
                        newFacetAddress,
                        IDiamondCut.FacetCutAction.Replace,
                        finalSelectorsToReplace
                    )
                );
            }
        }

        // Process additions
        for (uint256 i = 0; i < newFacets.length; i++) {
            bytes4[] memory selectorsToAdd = new bytes4[](newFacets[i].functionSelectors.length);
            uint256 addCount = 0;

            for (uint256 j = 0; j < newFacets[i].functionSelectors.length; j++) {
                bytes4 selector = newFacets[i].functionSelectors[j];
                bool isNewSelector = true;
                for (uint256 k = 0; k < currentFacets.length; k++) {
                    if (contains(currentFacets[k].functionSelectors, selector)) {
                        isNewSelector = false;
                        break;
                    }
                }
                if (isNewSelector) {
                    selectorsToAdd[addCount] = selector;
                    addCount++;
                }
            }

            if (addCount > 0) {
                bytes4[] memory finalSelectorsToAdd = new bytes4[](addCount);
                for (uint256 j = 0; j < addCount; j++) {
                    finalSelectorsToAdd[j] = selectorsToAdd[j];
                }
                cuts = appendToCuts(
                    cuts,
                    IDiamondCut.FacetCut(
                        newFacets[i].facetAddress,
                        IDiamondCut.FacetCutAction.Add,
                        finalSelectorsToAdd
                    )
                );
            }
        }

        return cuts;
    }

    function findNewFacetAddress(
        bytes4 selector,
        bytes4[] memory allSelectors,
        address[] memory allNewFacetAddresses
    ) internal pure returns (bool, address) {
        for (uint256 i = 0; i < allSelectors.length; i++) {
            if (allSelectors[i] == selector) {
                return (true, allNewFacetAddresses[i]);
            }
        }
        return (false, address(0));
    }

    // these append functions are not ideal in terms for gas/performance, but they are convenient for testing
    function appendToBytes4Array(
        bytes4[] memory array,
        bytes4 element
    ) internal pure returns (bytes4[] memory) {
        bytes4[] memory newArray = new bytes4[](array.length + 1);
        for (uint256 i = 0; i < array.length; i++) {
            newArray[i] = array[i];
        }
        newArray[array.length] = element;
        return newArray;
    }

    function appendToAddressArray(
        address[] memory array,
        address element
    ) internal pure returns (address[] memory) {
        address[] memory newArray = new address[](array.length + 1);
        for (uint256 i = 0; i < array.length; i++) {
            newArray[i] = array[i];
        }
        newArray[array.length] = element;
        return newArray;
    }

    function appendToCuts(
        IDiamondCut.FacetCut[] memory cuts,
        IDiamondCut.FacetCut memory newCut
    ) internal pure returns (IDiamondCut.FacetCut[] memory) {
        IDiamondCut.FacetCut[] memory newCuts = new IDiamondCut.FacetCut[](cuts.length + 1);
        for (uint i = 0; i < cuts.length; i++) {
            newCuts[i] = cuts[i];
        }
        newCuts[cuts.length] = newCut;
        return newCuts;
    }

    function contains(bytes4[] memory array, bytes4 value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }

    function _decodeDiamondCut(
        bytes memory data
    ) internal pure returns (IDiamondCut.FacetCut[] memory) {
        uint256 pointer = 0;
        uint256 numCuts = uint256(bytes32(slice(data, pointer, 32)));
        pointer += 32;

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](numCuts);

        for (uint256 i = 0; i < numCuts; i++) {
            address facetAddress = address(bytes20(slice(data, pointer, 20)));
            pointer += 20;

            uint8 action = uint8(slice(data, pointer, 1)[0]);
            pointer += 1;

            uint16 numSelectors = uint16(bytes2(slice(data, pointer, 2)));
            pointer += 2;

            bytes4[] memory selectors = new bytes4[](numSelectors);
            for (uint256 j = 0; j < numSelectors; j++) {
                selectors[j] = bytes4(slice(data, pointer, 4));
                pointer += 4;
            }

            cuts[i] = IDiamondCut.FacetCut(
                facetAddress,
                IDiamondCut.FacetCutAction(action),
                selectors
            );
        }

        return cuts;
    }

    function slice(
        bytes memory data,
        uint256 start,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }
}

contract EmptyInitContract {
    function init() external {}
}
