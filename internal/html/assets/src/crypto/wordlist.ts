// BIP39 wordlist handling - imports existing wordlist files at build time
// esbuild bundles these as strings using the text loader

// Import wordlists from the existing Go codebase
// These paths are resolved relative to the project root by esbuild
import englishWords from '../../../../core/wordlists/english.txt';

import { sha256 } from './hash';

// Parse wordlist text into array
function parseWordlist(text: string): string[] {
  return text.trim().split('\n').map(w => w.trim());
}

// Lazy-loaded wordlists
let englishWordlist: string[] | null = null;
let englishIndex: Map<string, number> | null = null;

function getEnglishWordlist(): string[] {
  if (!englishWordlist) {
    englishWordlist = parseWordlist(englishWords);
  }
  return englishWordlist;
}

function getEnglishIndex(): Map<string, number> {
  if (!englishIndex) {
    const words = getEnglishWordlist();
    englishIndex = new Map();
    for (let i = 0; i < words.length; i++) {
      englishIndex.set(words[i].toLowerCase(), i);
    }
  }
  return englishIndex;
}

/**
 * Look up a word's BIP39 index (0-2047).
 * Returns -1 if not found.
 */
export function lookupWord(word: string): number {
  const index = getEnglishIndex();
  const idx = index.get(word.toLowerCase().trim());
  return idx !== undefined ? idx : -1;
}

/**
 * Get word at BIP39 index.
 */
export function getWord(index: number): string {
  const words = getEnglishWordlist();
  if (index < 0 || index >= words.length) {
    throw new Error(`Invalid word index: ${index}`);
  }
  return words[index];
}

/**
 * Extract an 11-bit value starting at the given bit offset.
 * Out-of-range bits are treated as zero (for padding the final chunk).
 */
function extract11Bits(data: Uint8Array, bitOffset: number): number {
  let val = 0;
  for (let b = 0; b < 11; b++) {
    const byteIdx = Math.floor((bitOffset + b) / 8);
    const bitIdx = 7 - ((bitOffset + b) % 8);
    if (byteIdx < data.length) {
      val = (val << 1) | ((data[byteIdx] >> bitIdx) & 1);
    } else {
      val <<= 1; // pad with zero
    }
  }
  return val;
}

/**
 * Set an 11-bit value at the given bit offset in data.
 * Precondition: target bits must be zero-initialized.
 */
function set11Bits(data: Uint8Array, bitOffset: number, val: number): void {
  for (let b = 0; b < 11; b++) {
    const byteIdx = Math.floor((bitOffset + b) / 8);
    const bitIdx = 7 - ((bitOffset + b) % 8);
    if (byteIdx < data.length) {
      if (((val >> (10 - b)) & 1) === 1) {
        data[byteIdx] |= 1 << bitIdx;
      }
    }
  }
}

/**
 * Encode bytes to BIP39 words (11 bits per word).
 * 33 bytes (264 bits) produces exactly 24 words.
 */
export function encodeWords(data: Uint8Array): string[] {
  const totalBits = data.length * 8;
  const numWords = Math.ceil(totalBits / 11);
  const words: string[] = [];

  for (let i = 0; i < numWords; i++) {
    const idx = extract11Bits(data, i * 11);
    words.push(getWord(idx));
  }

  return words;
}

/**
 * Decode BIP39 words back to bytes.
 */
export function decodeWords(words: string[]): Uint8Array {
  if (words.length === 0) {
    throw new Error('no words provided');
  }

  const indices: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const idx = lookupWord(words[i]);
    if (idx < 0) {
      throw new Error(`word ${i + 1} "${words[i]}" not recognized`);
    }
    indices.push(idx);
  }

  const totalBits = words.length * 11;
  const numBytes = Math.floor(totalBits / 8);
  const result = new Uint8Array(numBytes);

  for (let i = 0; i < indices.length; i++) {
    set11Bits(result, i * 11, indices[i]);
  }

  return result;
}

// Word 25 layout (11 bits total):
// - Upper 4 bits (bits 10-7): share index (1-15, 0 = unknown/16+)
// - Lower 7 bits (bits 6-0): checksum (lower 7 bits of SHA-256(data)[0])

const WORD25_INDEX_BITS = 4;
const WORD25_CHECK_BITS = 7;
const WORD25_MAX_INDEX = (1 << WORD25_INDEX_BITS) - 1; // 15
const WORD25_CHECK_MASK = (1 << WORD25_CHECK_BITS) - 1; // 0x7F

/**
 * Compute the 7-bit checksum for the 25th word.
 */
export async function word25Checksum(data: Uint8Array): Promise<number> {
  const hash = await sha256(data);
  return hash[0] & WORD25_CHECK_MASK;
}

/**
 * Pack share index and data checksum into an 11-bit BIP39 word index.
 */
export async function word25Encode(shareIndex: number, data: Uint8Array): Promise<number> {
  let idx = shareIndex;
  if (idx > WORD25_MAX_INDEX) {
    idx = 0; // sentinel: index not representable in 4 bits
  }
  const check = await word25Checksum(data);
  return (idx << WORD25_CHECK_BITS) | check;
}

/**
 * Unpack the 25th word's 11-bit value into index and checksum.
 */
export function word25Decode(val: number): { index: number; checksum: number } {
  return {
    index: val >> WORD25_CHECK_BITS,
    checksum: val & WORD25_CHECK_MASK,
  };
}

/**
 * Decode 25 BIP39 words into share data and index.
 * The first 24 words are decoded to bytes; the 25th word carries index + checksum.
 * Returns index=0 if the share index was > 15 (the sentinel value).
 * Throws if the checksum doesn't match.
 */
export async function decodeShareWords(words: string[]): Promise<{
  data: Uint8Array;
  index: number;
}> {
  if (words.length !== 25) {
    throw new Error(`expected 25 words, got ${words.length}`);
  }

  // Look up the 25th word
  const lastIdx = lookupWord(words[24]);
  if (lastIdx < 0) {
    throw new Error(`word 25 "${words[24]}" not recognized`);
  }

  // Decode the data words (first 24)
  const data = decodeWords(words.slice(0, 24));

  // Unpack index and checksum from the 25th word
  const { index, checksum: expectedCheck } = word25Decode(lastIdx);

  // Verify checksum
  const actualCheck = await word25Checksum(data);
  if (actualCheck !== expectedCheck) {
    throw new Error('word checksum failed — check word order and spelling');
  }

  return { data, index };
}
