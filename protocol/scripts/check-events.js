/**
 * check-events.js
 * ---------------
 * 
 * Throughout Beanstalk, events are often copied between facets and libraries.
 * This script checks that events are consistent across all individual ABIs.
 */

const path = require("path");
const fs = require("fs");
const glob = require("glob");

// The glob returns the full file path like this:
// contracts/beanstalk/barn/UnripeFacet.sol
// We want the "UnripeFacet" part.
const getFacetName = (file) => {
  return file.split("/").pop().split(".")[0];
};

const pattern = path.join(".", "contracts", "beanstalk", "**", "*Facet.sol");
const files = glob.sync(pattern);
const eventNameToItem  = new Map();
const eventNameToFiles = new Map();

console.log("Searching: ", pattern, files.length)

files.forEach((file) => {
  const facetName = getFacetName(file);
  const jsonFileName = `${facetName}.json`;
  const jsonFileLoc = path.join(".", "artifacts", file, jsonFileName);

  const json = JSON.parse(fs.readFileSync(jsonFileLoc));
  const abi = json.abi;

  abi.filter((item) => item.type == "event").forEach((item) => {
    // If event already exists, compare new version to previous version
    const existingEvent = eventNameToItem.get(item.name);
    if (existingEvent) {
      // Compare inputs, the order and length of the arrays should match
      item.inputs.forEach((input, index) => {
        if (input.name !== existingEvent.inputs[index].name || input.type !== existingEvent.inputs[index].type) {
          console.error("Event mismatch", {
            new: input,
            existing: existingEvent.inputs[index]
          })
          throw new Error("Event mismatch")
        }
      })

      eventNameToFiles.set(item.name, [...eventNameToFiles.get(item.name), file])
    } else {
      eventNameToItem.set(item.name, item);
      eventNameToFiles.set(item.name, [file]);
    }
  });
  
});

console.log(eventNameToFiles)