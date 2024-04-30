/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
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
import {MockConvertFacet, ConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {MockSeasonFacet, SeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {SeasonGettersFacet} from "contracts/beanstalk/sun/SeasonFacet/SeasonGettersFacet.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract BeanstalkDeployer is Utils {
    // beanstalk
    address payable constant BEANSTALK =
        payable(address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5));

    address constant BASE_FEE_CONTRACT = address(0x84292919cB64b590C0131550483707E43Ef223aC);

    address internal deployer;

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
        "DepotFacet"
    ];

    // Facets that have a mock counter part should be appended here.
    string[] mockFacets = [
        "FertilizerFacet",
        "FieldFacet",
        "MarketplaceFacet",
        "WhitelistFacet",
        "SiloFacet",
        "UnripeFacet",
        "ConvertFacet",
        "SeasonFacet"
    ];
    address[] facetAddresses;
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
                facetAddresses.push(address(deployCode(facetName)));
            }
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
                facetAddress = address(new MockUnripeFacet());
            } else if (hashedName == keccak256(abi.encode("ConvertFacet"))) {
                facetAddress = address(new MockConvertFacet());
            } else if (hashedName == keccak256(abi.encode("SeasonFacet"))) {
                facetAddress = address(new MockSeasonFacet());
            } else {
                facetAddress = address(deployCode(facet));
            }

            facetAddresses.push(facetAddress);

            // append the facet name to the facets array.
            facets.push(facet);
        }
        IDiamondCut.FacetCut[] memory cut = _multiCut(facets, facetAddresses);
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
        address initAddress,
        bytes memory initFunctionCall,
        bytes4[] memory selectorsToRemove
    ) internal {
        vm.startPrank(diamondOwner);

        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](newFacetNames.length + 1);

        // generate cut for new facets:
        cut = _multiCutWithSelectorRemovals(newFacetNames, newFacetAddresses, selectorsToRemove);

        // call diamondcut
        IDiamondCut(diamondAddress).diamondCut(cut, initAddress, initFunctionCall);
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
        address[] memory _facetAddresses
    ) internal returns (IDiamondCut.FacetCut[] memory cutArray) {
        cutArray = new IDiamondCut.FacetCut[](_facetNames.length);
        bytes4[][] memory functionSelectorsArray = _generateMultiSelectors(_facetNames);
        for (uint i; i < _facetNames.length; i++) {
            cutArray[i] = IDiamondCut.FacetCut({
                facetAddress: _facetAddresses[i],
                action: IDiamondCut.FacetCutAction.Add,
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
        bytes4[] memory _selectorsToRemove
    ) internal returns (IDiamondCut.FacetCut[] memory cutArray) {
        // get inital cutArray.
        cutArray = _multiCut(_facetNames, _facetAddresses);

        // generate cuts for selectors to remove.
        if (_selectorsToRemove.length != 0) {
            assembly {
                mstore(cutArray, add(mload(cutArray), 1))
            }

            cutArray[cutArray.length - 1] = IDiamondCut.FacetCut(
                address(0),
                IDiamondCut.FacetCutAction.Remove,
                _selectorsToRemove
            );
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
        selectorsArray = abi.decode(res, (bytes4[][]));
    }
}
