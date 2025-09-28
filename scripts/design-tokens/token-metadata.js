const path = require('node:path');

const colors = require(
  path.resolve(__dirname, '../../src/components/ui/colors')
);

const spacingScale = [
  { token: '0', value: 0 },
  { token: 'px', value: 1 },
  { token: '0.5', value: 2 },
  { token: '1', value: 4 },
  { token: '1.5', value: 6 },
  { token: '2', value: 8 },
  { token: '2.5', value: 10 },
  { token: '3', value: 12 },
  { token: '3.5', value: 14 },
  { token: '4', value: 16 },
  { token: '5', value: 20 },
  { token: '6', value: 24 },
  { token: '7', value: 28 },
  { token: '8', value: 32 },
  { token: '9', value: 36 },
  { token: '10', value: 40 },
  { token: '11', value: 44 },
  { token: '12', value: 48 },
  { token: '14', value: 56 },
  { token: '16', value: 64 },
  { token: '20', value: 80 },
  { token: '24', value: 96 },
  { token: '28', value: 112 },
  { token: '32', value: 128 },
  { token: '36', value: 144 },
  { token: '40', value: 160 },
  { token: '44', value: 176 },
  { token: '48', value: 192 },
  { token: '52', value: 208 },
  { token: '56', value: 224 },
  { token: '60', value: 240 },
  { token: '64', value: 256 },
  { token: '72', value: 288 },
  { token: '80', value: 320 },
  { token: '96', value: 384 },
];

const spacingLookup = spacingScale.reduce((acc, entry) => {
  const existing = acc.get(entry.value);
  if (existing) {
    existing.push(entry.token);
    return acc;
  }

  acc.set(entry.value, [entry.token]);
  return acc;
}, new Map());

const flattenColors = (colorObject, prefix = []) => {
  return Object.entries(colorObject).flatMap(([key, value]) => {
    if (typeof value === 'string') {
      return [
        {
          token: [...prefix, key].join('-'),
          hex: normalizeHex(value),
        },
      ];
    }

    return flattenColors(value, [...prefix, key]);
  });
};

const colorTokens = flattenColors(colors);

const colorLookup = colorTokens.reduce((acc, tokenInfo) => {
  if (!tokenInfo.hex) {
    return acc;
  }

  const matches = acc.get(tokenInfo.hex) ?? [];
  matches.push(tokenInfo.token);
  acc.set(tokenInfo.hex, matches);
  return acc;
}, new Map());

function normalizeHex(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith('#')) {
    return null;
  }

  let value = trimmed.slice(1);

  if ([3, 4].includes(value.length)) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (![6, 8].includes(value.length)) {
    return null;
  }

  return `#${value.toUpperCase()}`;
}

function getColorTokens() {
  return [...colorTokens];
}

function getColorTokenSuggestions(hexValue) {
  const normalized = normalizeHex(hexValue);
  if (!normalized) {
    return [];
  }

  return colorLookup.get(normalized) ?? [];
}

function getSpacingTokenSuggestions(value) {
  if (typeof value !== 'number') {
    return [];
  }

  return spacingLookup.get(value) ?? [];
}

module.exports = {
  getColorTokens,
  getColorTokenSuggestions,
  getSpacingTokenSuggestions,
  spacingScale,
  normalizeHex,
};
