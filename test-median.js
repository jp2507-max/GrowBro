const testMedian = (arr) => {
  if (arr.length === 0) {
    return null;
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const length = sorted.length;
  return length % 2 === 0
    ? (sorted[length / 2 - 1] + sorted[length / 2]) / 2
    : sorted[Math.floor(length / 2)];
};

// Test cases
console.log('Odd length [1,2,3]:', testMedian([1, 2, 3])); // Should be 2
console.log('Even length [1,2,3,4]:', testMedian([1, 2, 3, 4])); // Should be 2.5
console.log('Even length [1,3,5,7]:', testMedian([1, 3, 5, 7])); // Should be 4
console.log('Single element [5]:', testMedian([5])); // Should be 5
console.log('Empty array []:', testMedian([])); // Should be null

// Test that input array is not mutated
const originalArray = [3, 1, 4, 1, 5];
const originalCopy = [...originalArray];
console.log('Median result:', testMedian(originalArray));
console.log(
  'Original array unchanged:',
  JSON.stringify(originalArray) === JSON.stringify(originalCopy)
);
