import { CourtDimensions } from '../types/game';
import { CourtStep, NormalizedStep, StepSet } from '../types/drill';

const LEGACY_SCHEME = 'badminton-court-simulator';
const LEGACY_IMPORT_PATH = 'import';
export const SHARE_BASE_URL = 'https://badmlabs.github.io/i.html';

const SHARE_LINK_PATTERN =
  /(?:badminton-court-simulator:\/\/import|https:\/\/badmlabs\.github\.io\/(?:court\/import(?:\.html|\/)?|i(?:\.html)?))\?d=([A-Za-z0-9\-_]+)/;

// v3 binary format: coordinates quantized to 12 bits over [-0.5, 1.5],
// which keeps off-court positions and gives ~0.0005 court-size resolution.
const V3_VERSION = 3;
const COORD_BITS = 12;
const COORD_MAX = (1 << COORD_BITS) - 1;
const COORD_MIN_VALUE = -0.5;
const COORD_RANGE = 2;

function quantizeCoord(value: number): number {
  const scaled = Math.round(((value - COORD_MIN_VALUE) / COORD_RANGE) * COORD_MAX);
  return Math.min(COORD_MAX, Math.max(0, scaled));
}

function dequantizeCoord(quantized: number): number {
  return (quantized / COORD_MAX) * COORD_RANGE + COORD_MIN_VALUE;
}

class BitWriter {
  private bytes: number[] = [];
  private bitBuffer = 0;
  private bitCount = 0;

  write(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      this.bitBuffer = (this.bitBuffer << 1) | ((value >> i) & 1);
      this.bitCount++;
      if (this.bitCount === 8) {
        this.bytes.push(this.bitBuffer);
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
    }
  }

  toBytes(): number[] {
    const result = [...this.bytes];
    if (this.bitCount > 0) {
      result.push(this.bitBuffer << (8 - this.bitCount));
    }
    return result;
  }
}

class BitReader {
  private bitIndex = 0;

  constructor(private readonly bytes: string, private readonly byteOffset: number) {}

  get remainingBits(): number {
    return (this.bytes.length - this.byteOffset) * 8 - this.bitIndex;
  }

  read(bits: number): number {
    let value = 0;
    for (let i = 0; i < bits; i++) {
      const absoluteBit = this.bitIndex + i;
      const byte = this.bytes.charCodeAt(this.byteOffset + (absoluteBit >> 3));
      value = (value << 1) | ((byte >> (7 - (absoluteBit & 7))) & 1);
    }
    this.bitIndex += bits;
    return value;
  }
}

function utf8Encode(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const low = value.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string {
  let output = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i++];
    let code: number;
    if (byte < 0x80) {
      code = byte;
    } else if (byte < 0xe0) {
      code = ((byte & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (byte < 0xf0) {
      code = ((byte & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      code =
        ((byte & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    }

    if (code >= 0x10000) {
      code -= 0x10000;
      output += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      output += String.fromCharCode(code);
    }
  }
  return output;
}

function normalizePosition(
  position: { x: number; y: number },
  dimensions: CourtDimensions
): { x: number; y: number } {
  return {
    x: dimensions.width > 0 ? position.x / dimensions.width : 0,
    y: dimensions.height > 0 ? position.y / dimensions.height : 0,
  };
}

function denormalizePosition(
  position: { x: number; y: number },
  dimensions: CourtDimensions
): { x: number; y: number } {
  return {
    x: position.x * dimensions.width,
    y: position.y * dimensions.height,
  };
}

export function normalizeSteps(
  steps: CourtStep[],
  dimensions: CourtDimensions
): NormalizedStep[] {
  return steps.map((step) => ({
    players: {
      team1: step.players.team1.map((pos) => normalizePosition(pos, dimensions)),
      team2: step.players.team2.map((pos) => normalizePosition(pos, dimensions)),
    },
    shuttle: normalizePosition(step.shuttle, dimensions),
    ghostPositions: {
      team1: step.ghostPositions.team1.map((pos) => normalizePosition(pos, dimensions)),
      team2: step.ghostPositions.team2.map((pos) => normalizePosition(pos, dimensions)),
      shuttle: normalizePosition(step.ghostPositions.shuttle, dimensions),
    },
  }));
}

export function denormalizeSteps(
  steps: NormalizedStep[],
  dimensions: CourtDimensions
): CourtStep[] {
  return steps.map((step) => ({
    players: {
      team1: step.players.team1.map((pos) => denormalizePosition(pos, dimensions)),
      team2: step.players.team2.map((pos) => denormalizePosition(pos, dimensions)),
    },
    shuttle: denormalizePosition(step.shuttle, dimensions),
    ghostPositions: {
      team1: step.ghostPositions.team1.map((pos) => denormalizePosition(pos, dimensions)),
      team2: step.ghostPositions.team2.map((pos) => denormalizePosition(pos, dimensions)),
      shuttle: denormalizePosition(step.ghostPositions.shuttle, dimensions),
    },
  }));
}

function encodeBase64(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;

  while (i < value.length) {
    const chr1 = value.charCodeAt(i++);
    const chr2 = value.charCodeAt(i++);
    const chr3 = value.charCodeAt(i++);

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    const enc3 = isNaN(chr2) ? 64 : (((chr2 & 15) << 2) | (chr3 >> 6));
    const enc4 = isNaN(chr3) ? 64 : (chr3 & 63);

    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }

  return output;
}

function decodeBase64(value: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(value);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;

  const input = value.replace(/[^A-Za-z0-9+/=]/g, '');

  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  return output;
}

export function createStepSet(
  name: string,
  isDoubles: boolean,
  steps: CourtStep[],
  dimensions: CourtDimensions
): StepSet {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    isDoubles,
    steps: normalizeSteps(steps, dimensions),
    createdAt: Date.now(),
  };
}

function flattenStep(step: NormalizedStep, isDoubles: boolean): number[] {
  const values: number[] = [];
  const playersPerTeam = isDoubles ? 2 : 1;
  const team1 = step.players.team1.slice(0, playersPerTeam);
  const team2 = step.players.team2.slice(0, playersPerTeam);

  for (const position of team1) {
    values.push(position.x, position.y);
  }
  for (const position of team2) {
    values.push(position.x, position.y);
  }
  values.push(step.shuttle.x, step.shuttle.y);
  return values;
}

function expandCompactSteps(values: number[][], isDoubles: boolean): NormalizedStep[] {
  return values.map((flat, index) => {
    const team1Count = isDoubles ? 2 : 1;
    const team2Count = isDoubles ? 2 : 1;
    let cursor = 0;

    const readPosition = () => ({
      x: flat[cursor++],
      y: flat[cursor++],
    });

    const players = {
      team1: Array.from({ length: team1Count }, readPosition),
      team2: Array.from({ length: team2Count }, readPosition),
    };
    const shuttle = readPosition();

    const previousStep = index > 0 ? expandCompactSteps([values[index - 1]], isDoubles)[0] : null;
    const ghostPositions = previousStep
      ? {
          team1: previousStep.players.team1,
          team2: previousStep.players.team2,
          shuttle: previousStep.shuttle,
        }
      : {
          team1: players.team1,
          team2: players.team2,
          shuttle,
        };

    return {
      players,
      shuttle,
      ghostPositions,
    };
  });
}

function encodePayload(stepSet: StepSet): string {
  const nameBytes = utf8Encode(stepSet.name).slice(0, 255);
  const steps = stepSet.steps.slice(0, 255);

  const header = [
    V3_VERSION,
    stepSet.isDoubles ? 1 : 0,
    nameBytes.length,
    ...nameBytes,
    steps.length,
  ];

  const writer = new BitWriter();
  for (const step of steps) {
    for (const coord of flattenStep(step, stepSet.isDoubles)) {
      writer.write(quantizeCoord(coord), COORD_BITS);
    }
  }

  const bytes = [...header, ...writer.toBytes()];
  const binary = bytes.map((byte) => String.fromCharCode(byte)).join('');

  return encodeBase64(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseV1Payload(payload: {
  name?: string;
  isDoubles?: boolean;
  steps?: NormalizedStep[];
}): StepSet | null {
  if (!payload?.steps?.length) {
    return null;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: payload.name || 'Imported Step Set',
    isDoubles: payload.isDoubles ?? true,
    steps: payload.steps,
    createdAt: Date.now(),
  };
}

function parseV2Payload(payload: {
  n?: string;
  b?: number;
  s?: number[][];
}): StepSet | null {
  if (!payload?.s?.length) {
    return null;
  }

  const isDoubles = payload.b !== 0;
  const steps = expandCompactSteps(payload.s, isDoubles);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: payload.n || 'Imported Step Set',
    isDoubles,
    steps,
    createdAt: Date.now(),
  };
}

function parseV3Payload(decoded: string): StepSet | null {
  // Layout: [version, flags, nameLength, ...nameUtf8, stepCount, ...packedCoords]
  if (decoded.length < 4) {
    return null;
  }

  const isDoubles = (decoded.charCodeAt(1) & 1) === 1;
  const nameLength = decoded.charCodeAt(2);
  const stepCountOffset = 3 + nameLength;
  if (decoded.length < stepCountOffset + 1) {
    return null;
  }

  const nameBytes: number[] = [];
  for (let i = 0; i < nameLength; i++) {
    nameBytes.push(decoded.charCodeAt(3 + i));
  }
  const name = utf8Decode(nameBytes);

  const stepCount = decoded.charCodeAt(stepCountOffset);
  if (stepCount === 0) {
    return null;
  }

  const coordsPerStep = ((isDoubles ? 4 : 2) + 1) * 2;
  const reader = new BitReader(decoded, stepCountOffset + 1);
  if (reader.remainingBits < stepCount * coordsPerStep * COORD_BITS) {
    return null;
  }

  const values: number[][] = [];
  for (let step = 0; step < stepCount; step++) {
    const flat: number[] = [];
    for (let coord = 0; coord < coordsPerStep; coord++) {
      flat.push(dequantizeCoord(reader.read(COORD_BITS)));
    }
    values.push(flat);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: name || 'Imported Step Set',
    isDoubles,
    steps: expandCompactSteps(values, isDoubles),
    createdAt: Date.now(),
  };
}

function parseEncodedPayload(encoded: string): StepSet | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = decodeBase64(padded);

    if (decoded.charCodeAt(0) === V3_VERSION) {
      return parseV3Payload(decoded);
    }

    const payload = JSON.parse(decoded) as {
      v?: number;
      name?: string;
      isDoubles?: boolean;
      steps?: NormalizedStep[];
      n?: string;
      b?: number;
      s?: number[][];
    };

    if (payload.v === 2) {
      return parseV2Payload(payload);
    }

    return parseV1Payload(payload);
  } catch {
    return null;
  }
}

export function encodeStepSetForSharing(stepSet: StepSet): string {
  return `${SHARE_BASE_URL}?d=${encodePayload(stepSet)}`;
}

export function encodeLegacyStepSetLink(stepSet: StepSet): string {
  return `${LEGACY_SCHEME}://${LEGACY_IMPORT_PATH}?d=${encodePayload(stepSet)}`;
}

export function decodeSharedStepSet(sharedText: string): StepSet | null {
  const trimmed = sharedText.trim();
  const match = trimmed.match(SHARE_LINK_PATTERN);

  if (!match) {
    return null;
  }

  return parseEncodedPayload(match[1]);
}

export function getShareMessage(stepSet: StepSet): string {
  const link = encodeStepSetForSharing(stepSet);
  return `Badminton drill: ${stepSet.name}\n\n${link}\n\nTap the link to open in Badminton Court Simulator, or copy and use Import from clipboard.`;
}
