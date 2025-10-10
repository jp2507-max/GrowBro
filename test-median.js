const testMedian = (arr) => {
  arr.sort((a, b) => a - b);
  const length = arr.length;
  return length % 2 === 0
    ? (arr[length / 2 - 1] + arr[length / 2]) / 2
    : arr[Math.floor(length / 2)];
};

// Test cases
console.log('Odd length [1,2,3]:', testMedian([1, 2, 3])); // Should be 2
console.log('Even length [1,2,3,4]:', testMedian([1, 2, 3, 4])); // Should be 2.5
console.log('Even length [1,3,5,7]:', testMedian([1, 3, 5, 7])); // Should be 4
console.log('Single element [5]:', testMedian([5])); // Should be 5
