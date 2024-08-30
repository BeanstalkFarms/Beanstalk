const ethers = require("ethers");

async function generateDiamondCut(existingFacets, newFacets) {
  const cuts = [];
  
  // Helper function to convert selector strings to bytes4
  const selectorToBytes4 = (selector) => {
    return selector.slice(0, 10); // Assuming selectors are already in '0x' format
  };

  // Process existing facets
  const existingSelectors = new Set();
  existingFacets.forEach(facet => {
    facet.selectors.forEach(selector => {
      existingSelectors.add(selectorToBytes4(selector));
    });
  });

  // Process new facets
  for (const newFacet of newFacets) {
    const facetCut = {
      facetAddress: newFacet.facetAddress,
      action: 0, // 0 for Add, 1 for Replace, 2 for Remove
      functionSelectors: []
    };

    newFacet.selectors.forEach(selector => {
      const bytes4Selector = selectorToBytes4(selector);
      if (existingSelectors.has(bytes4Selector)) {
        facetCut.action = 1; // Replace
      } else {
        facetCut.action = 0; // Add
      }
      facetCut.functionSelectors.push(bytes4Selector);
      existingSelectors.delete(bytes4Selector);
    });

    if (facetCut.functionSelectors.length > 0) {
      cuts.push(facetCut);
    }
  }

  // Handle removed selectors
  if (existingSelectors.size > 0) {
    cuts.push({
      facetAddress: '0x0000000000000000000000000000000000000000',
      action: 2, // Remove
      functionSelectors: Array.from(existingSelectors)
    });
  }

  return cuts;
}

async function processDiamondCut(existingFacets, newFacets) {
  try {
    const diamondCut = await generateDiamondCut(existingFacets, newFacets);
    const encoded = ethers.utils.defaultAbiCoder.encode(
      ["tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[]"],
      [diamondCut]
    );
    process.stdout.write(encoded);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// Example usage
const existingFacets = [
  {
    facetAddress: '0x1111111111111111111111111111111111111111',
    selectors: ['0x12345678', '0x23456789']
  }
];

const newFacets = [
  {
    facetAddress: '0x2222222222222222222222222222222222222222',
    selectors: ['0x12345678', '0x34567890']
  },
  {
    facetAddress: '0x3333333333333333333333333333333333333333',
    selectors: ['0x45678901', '0x56789012']
  }
];

processDiamondCut(existingFacets, newFacets)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });