# Hardcoded Line Policy

The companion should feel AI-driven, not like a traditional scripted follower. This branch changes non-critical ambient fallbacks to silent by default.

## Default Behavior

`Config.ambientFallbackMode` defaults to:

```text
silent
```

This means these non-critical systems do not speak fixed fallback flavor lines when the LLM is unavailable or mock mode is enabled:

- item pickup flavor
- hunger flavor
- party-join flavor
- room-entry flavor
- battle-end flavor barks

They still speak if the LLM successfully generates a valid line.

## Why Some Fixed Lines Remain

Some text is UI/state-control, not roleplay flavor. These lines are kept because they tell the player what just happened or what choice is pending:

- support item consent
- support item accepted/declined result
- equipment prompt accepted/declined result
- merchant buy confirmation
- debug/config labels
- fallback chat answers when all model calls fail and a knowledge-base answer exists

These should eventually become more customizable, but removing them entirely would make UI flows unclear.

## Temporary Legacy Mode

For regression testing only, hardcoded ambient fallbacks can be re-enabled from the console:

```javascript
AI_Companion.Config.ambientFallbackMode = 'legacy';
localStorage.setItem('AI_Companion_AmbientFallbackMode', 'legacy');
```

Return to AI-first behavior:

```javascript
AI_Companion.Config.ambientFallbackMode = 'silent';
localStorage.setItem('AI_Companion_AmbientFallbackMode', 'silent');
```

## Test Plan

1. Disable network/local model or enable mock mode.
2. Pick up an item.
3. Change maps.
4. Trigger hunger if possible.
5. Win a battle.

Pass:

- Non-critical roleplay flavor does not emit canned lines.
- Critical consent/approval prompts still appear.
- With a working LLM, generated ambient lines still appear normally.
