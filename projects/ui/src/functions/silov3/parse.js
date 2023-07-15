const fs = require('fs');

const files = [
  'deposits.json',
  'merkle.json'
]

// Function to transform keys to lowercase
function transformKeysToLowercase(obj) {
  // if (!obj || typeof obj !== 'object') return obj;
  // if (Array.isArray(obj)) return obj.map(transformKeysToLowercase);

  // return Object.keys(obj).reduce((accumulator, key) => {
  //   accumulator[
  //     key.startsWith('0x') ? key.toLowerCase() : key
  //   ] = transformKeysToLowercase(obj[key]);
  //   return accumulator;
  // }, {});

  return Object.keys(obj).reduce((accumulator, key) => {
    accumulator[
      key.startsWith('0x') ? key.toLowerCase() : key
    ] = obj[key];
    return accumulator;
  }, {});
}

for (const file of files) {
  // Load JSON from the file
  const data = JSON.parse(fs.readFileSync(`./data/raw/${file}`, 'utf8'));
  
  // Transform keys
  const transformedData = transformKeysToLowercase(data);
  
  // Write transformed data back to file
  fs.writeFileSync(`./data/${file}`, JSON.stringify(transformedData));
}

