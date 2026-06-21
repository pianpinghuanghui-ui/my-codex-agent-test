extends RefCounted

const STAGES := {
    "shinjuku_like": {
        "id": "shinjuku_like",
        "title": "Stage 1: Shinjuku-like",
        "size": 13,
        "cell_size": 8.0,
        "objective": "Collect the pass, key, charm, and fuse. Then reach the green exit lantern.",
        "items": [
            {
                "id": "station_pass",
                "label": "Station Pass",
                "color": Color(0.18, 0.83, 0.75, 1.0),
                "hint": "A cold ticket gate pass hums under a vending machine glow.",
            },
            {
                "id": "ward_key",
                "label": "Ward Key",
                "color": Color(0.98, 0.80, 0.08, 1.0),
                "hint": "A brass key hangs in a narrow service alley.",
            },
            {
                "id": "shrine_charm",
                "label": "Shrine Charm",
                "color": Color(0.98, 0.44, 0.52, 1.0),
                "hint": "A paper charm waits beside a forgotten street shrine.",
            },
            {
                "id": "power_fuse",
                "label": "Gate Fuse",
                "color": Color(0.38, 0.65, 0.98, 1.0),
                "hint": "A fuse box sparks near the elevated rail shadow.",
            },
        ],
        "palette": {
            "fog": Color(0.02, 0.02, 0.04, 1.0),
            "ground": Color(0.05, 0.07, 0.12, 1.0),
            "wall": Color(0.10, 0.13, 0.18, 1.0),
            "dark": Color(0.02, 0.025, 0.04, 1.0),
            "exit": Color(0.32, 1.0, 0.60, 1.0),
            "threat": Color(1.0, 0.13, 0.37, 1.0),
            "signs": [
                Color(1.0, 0.18, 0.58, 1.0),
                Color(0.16, 0.91, 1.0, 1.0),
                Color(0.98, 1.0, 0.0, 1.0),
                Color(0.70, 0.36, 1.0, 1.0),
                Color(1.0, 0.48, 0.10, 1.0),
            ],
        },
    },
}

static func get_stage(stage_id: String) -> Dictionary:
    if STAGES.has(stage_id):
        return STAGES[stage_id].duplicate(true)
    return STAGES["shinjuku_like"].duplicate(true)
