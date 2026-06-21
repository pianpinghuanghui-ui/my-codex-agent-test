export const STAGES = [
  {
    id: "shinjuku-like",
    title: "Stage 1: Shinjuku-like",
    size: 13,
    cellSize: 8,
    requiredItems: [
      {
        id: "station-pass",
        label: "Station Pass",
        color: 0x2dd4bf,
        hint: "A cold ticket gate pass hums under a vending machine glow.",
      },
      {
        id: "ward-key",
        label: "Ward Key",
        color: 0xfacc15,
        hint: "A brass key hangs in a narrow service alley.",
      },
      {
        id: "shrine-charm",
        label: "Shrine Charm",
        color: 0xfb7185,
        hint: "A paper charm waits beside a forgotten street shrine.",
      },
      {
        id: "power-fuse",
        label: "Gate Fuse",
        color: 0x60a5fa,
        hint: "A fuse box sparks near the elevated rail shadow.",
      },
    ],
    theme: {
      fog: 0x05050a,
      sky: 0x07070d,
      ground: 0x111827,
      wall: 0x1f2937,
      asphalt: 0x0f172a,
      exit: 0x52ff99,
      threat: 0xff225e,
      signs: [0xff2d95, 0x28e7ff, 0xfaff00, 0xb15cff, 0xff7a18],
    },
    objectiveText:
      "Collect the pass, key, charm, and fuse. Then reach the green exit lantern.",
  },
];

export function getStageById(id) {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0];
}
