const ethers = require("ethers");

async function generateDiamondCut(existingFacets, newFacets) {
  const cuts = [];

  // console.log("Generating diamond cut...");
  
  // Helper function to convert selector strings to bytes4
  const selectorToBytes4 = (selector) => {
    return selector.slice(0, 10); // Assuming selectors are already in '0x' format
  };

  // Process existing facets
  const existingSelectors = new Map();
  existingFacets.forEach(facet => {
    facet.selectors.forEach(selector => {
      existingSelectors.set(selectorToBytes4(selector), facet.facetAddress);
    });
  });

  // console.log(`Found ${existingSelectors.size} existing selectors`);
  // console.log("existing selectors: ", Array.from(existingSelectors.keys()));

  // Process new facets
  for (const newFacet of newFacets) {
    const addSelectors = [];
    const replaceSelectors = [];

    newFacet.selectors.forEach(selector => {
      const bytes4Selector = selectorToBytes4(selector);
      if (existingSelectors.has(bytes4Selector)) {
        replaceSelectors.push(bytes4Selector);
      } else {
        addSelectors.push(bytes4Selector);
      }
      existingSelectors.delete(bytes4Selector);
    });

    if (addSelectors.length > 0) {
      cuts.push({
        facetAddress: newFacet.facetAddress,
        action: 0, // Add
        functionSelectors: addSelectors
      });
    }

    if (replaceSelectors.length > 0) {
      cuts.push({
        facetAddress: newFacet.facetAddress,
        action: 1, // Replace
        functionSelectors: replaceSelectors
      });
    }
  }

  // console.log(`Found ${existingSelectors.size} removed selectors`);

  // Handle removed selectors
  if (existingSelectors.size > 0) {
    cuts.push({
      facetAddress: '0x0000000000000000000000000000000000000000',
      action: 2, // Remove
      functionSelectors: Array.from(existingSelectors.keys())
    });
  }

  // console.log(`Generated ${cuts.length} cuts`);
  // console.log("final cuts: ", cuts);

  return cuts;
}

async function processDiamondCut(existingFacetsJson, newFacetsJson) {
  try {
    const existingFacets = JSON.parse(existingFacetsJson);
    const newFacets = JSON.parse(newFacetsJson);
    const diamondCut = await generateDiamondCut(existingFacets, newFacets);
    
    // Compact encoding
    let encoded = ethers.utils.hexlify(ethers.utils.pack(['uint256'], [diamondCut.length]));
    
    for (const cut of diamondCut) {
      encoded += ethers.utils.hexlify(cut.facetAddress).slice(2);
      encoded += ethers.utils.hexZeroPad(ethers.utils.hexlify(cut.action), 1).slice(2);
      encoded += ethers.utils.hexZeroPad(ethers.utils.hexlify(cut.functionSelectors.length), 2).slice(2);
      for (const selector of cut.functionSelectors) {
        encoded += selector.slice(2);
      }
    }

    process.stdout.write(encoded);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: node genDiamondCut.js <existingFacetsJson> <newFacetsJson>");
  process.exit(1);
}

processDiamondCut(args[0], args[1])
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });