import {
  createStepSet,
  decodeSharedStepSet,
  encodeLegacyStepSetLink,
  encodeStepSetForSharing,
  getShareMessage,
  SHARE_BASE_URL,
} from '../stepSharing';
import { CourtStep } from '../../types/drill';

describe('stepSharing', () => {
  const sampleSteps: CourtStep[] = [
    {
      players: {
        team1: [{ x: 100, y: 200 }, { x: 150, y: 250 }],
        team2: [{ x: 300, y: 200 }, { x: 350, y: 250 }],
      },
      shuttle: { x: 200, y: 400 },
      ghostPositions: {
        team1: [{ x: 90, y: 190 }, { x: 140, y: 240 }],
        team2: [{ x: 290, y: 190 }, { x: 340, y: 240 }],
        shuttle: { x: 190, y: 390 },
      },
    },
    {
      players: {
        team1: [{ x: 120, y: 220 }, { x: 170, y: 270 }],
        team2: [{ x: 320, y: 220 }, { x: 370, y: 270 }],
      },
      shuttle: { x: 220, y: 420 },
      ghostPositions: {
        team1: [{ x: 100, y: 200 }, { x: 150, y: 250 }],
        team2: [{ x: 300, y: 200 }, { x: 350, y: 250 }],
        shuttle: { x: 200, y: 400 },
      },
    },
  ];

  it('encodes and decodes a step set through an https share link', () => {
    const stepSet = createStepSet('Serve Drill', true, sampleSteps, {
      width: 400,
      height: 800,
    });

    const link = encodeStepSetForSharing(stepSet);
    expect(link).toContain(`${SHARE_BASE_URL}?d=`);

    const decoded = decodeSharedStepSet(link);
    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe('Serve Drill');
    expect(decoded?.isDoubles).toBe(true);
    expect(decoded?.steps).toHaveLength(2);
    expect(decoded?.steps[0].players.team1[0].x).toBeCloseTo(0.25, 3);
    expect(decoded?.steps[0].players.team2[1].y).toBeCloseTo(0.3125, 3);
    expect(decoded?.steps[1].ghostPositions.team1[0].x).toBeCloseTo(0.25, 3);
  });

  it('decodes legacy custom scheme links for backward compatibility', () => {
    const stepSet = createStepSet('Legacy Drill', true, sampleSteps.slice(0, 1), {
      width: 400,
      height: 800,
    });

    const legacyLink = encodeLegacyStepSetLink(stepSet);
    const decoded = decodeSharedStepSet(legacyLink);

    expect(decoded?.name).toBe('Legacy Drill');
    expect(decoded?.steps).toHaveLength(1);
  });

  it('decodes v1 https links with full step payloads', () => {
    const stepSet = createStepSet('V1 Drill', true, sampleSteps.slice(0, 1), {
      width: 400,
      height: 800,
    });
    const v1Payload = Buffer.from(
      JSON.stringify({
        v: 1,
        name: stepSet.name,
        isDoubles: stepSet.isDoubles,
        steps: stepSet.steps,
      })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    const v1Link = `${SHARE_BASE_URL}?d=${v1Payload}`;
    const decoded = decodeSharedStepSet(v1Link);

    expect(decoded?.name).toBe('V1 Drill');
    expect(decoded?.steps).toHaveLength(1);
  });

  it('decodes v2 json links for backward compatibility', () => {
    const v2Payload = Buffer.from(
      JSON.stringify({
        v: 2,
        n: 'V2 Drill',
        b: 1,
        s: [[0.25, 0.25, 0.375, 0.313, 0.75, 0.25, 0.875, 0.313, 0.5, 0.5]],
      })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    const v2Link = `https://badmlabs.github.io/court/import.html?d=${v2Payload}`;
    const decoded = decodeSharedStepSet(v2Link);

    expect(decoded?.name).toBe('V2 Drill');
    expect(decoded?.isDoubles).toBe(true);
    expect(decoded?.steps).toHaveLength(1);
    expect(decoded?.steps[0].shuttle.x).toBeCloseTo(0.5, 3);
  });

  it('decodes old /court/import links with v3 payloads', () => {
    const stepSet = createStepSet('Old Path', true, sampleSteps.slice(0, 1), {
      width: 400,
      height: 800,
    });
    const payload = encodeStepSetForSharing(stepSet).split('?d=')[1];

    const decodedNoSlash = decodeSharedStepSet(
      `https://badmlabs.github.io/court/import?d=${payload}`
    );
    const decodedSlash = decodeSharedStepSet(
      `https://badmlabs.github.io/court/import/?d=${payload}`
    );

    expect(decodedNoSlash?.name).toBe('Old Path');
    expect(decodedSlash?.name).toBe('Old Path');
  });

  it('uses a compact share link for multi-step drills', () => {
    const steps = Array.from({ length: 10 }, (_, index) => ({
      ...sampleSteps[0],
      shuttle: { x: 200 + index, y: 400 - index },
    }));

    const stepSet = createStepSet('F1', true, steps, { width: 400, height: 800 });
    const link = encodeStepSetForSharing(stepSet);

    expect(link.length).toBeLessThan(300);

    const decoded = decodeSharedStepSet(link);
    expect(decoded?.steps).toHaveLength(10);
    expect(decoded?.steps[9].shuttle.x).toBeCloseTo(209 / 400, 3);
    expect(decoded?.steps[9].ghostPositions.shuttle.x).toBeCloseTo(208 / 400, 3);
  });

  it('round-trips names with non-ascii characters', () => {
    const stepSet = createStepSet('Smash 强攻 🏸', true, sampleSteps.slice(0, 1), {
      width: 400,
      height: 800,
    });

    const decoded = decodeSharedStepSet(encodeStepSetForSharing(stepSet));
    expect(decoded?.name).toBe('Smash 强攻 🏸');
  });

  it('clamps off-court coordinates instead of corrupting the payload', () => {
    const offCourt: CourtStep = {
      ...sampleSteps[0],
      players: {
        team1: [{ x: -400, y: 200 }, { x: 150, y: 250 }],
        team2: [{ x: 900, y: 200 }, { x: 350, y: 250 }],
      },
    };

    const stepSet = createStepSet('Clamp', true, [offCourt], { width: 400, height: 800 });
    const decoded = decodeSharedStepSet(encodeStepSetForSharing(stepSet));

    expect(decoded?.steps[0].players.team1[0].x).toBeCloseTo(-0.5, 3);
    expect(decoded?.steps[0].players.team2[0].x).toBeCloseTo(1.5, 3);
  });

  it('parses a share link embedded in a WhatsApp-style message', () => {
    const stepSet = createStepSet('Net Kill', false, sampleSteps.slice(0, 1), {
      width: 400,
      height: 800,
    });

    const message = getShareMessage(stepSet);
    const decoded = decodeSharedStepSet(message);

    expect(decoded?.name).toBe('Net Kill');
    expect(decoded?.isDoubles).toBe(false);
    expect(decoded?.steps).toHaveLength(1);
    expect(message).toContain('Tap the link to open');
  });
});
