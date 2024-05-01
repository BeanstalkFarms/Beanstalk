// AssemblyScript code for a binary search on an array of u32
export function u32_binarySearchIndex(arr: u32[], target: u32): u32 {
  let low: u32 = 0;
  let high: u32 = arr.length - 1;

  while (low <= high) {
    let mid: u32 = low + (high - low) / 2; // To prevent overflow

    // Check if target is present at mid
    if (arr[mid] === target) {
      return mid;
    }

    // If target greater, ignore left half
    if (arr[mid] < target) {
      low = mid + 1;
    }
    // If target is smaller, ignore right half
    else {
      high = mid - 1;
    }
  }

  // Target was not found in the array
  return -1;
}
