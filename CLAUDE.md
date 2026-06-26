# Project Instructions

## After push or merge to main

Always check CI:

```bash
gh run list --repo hermes98761234/browser-shooter --branch main --limit 2
gh run watch <run-id> --exit-status
```

If build fails, fix and push before reporting done.

## Plan Execution Preference

Always use **Subagent-Driven** execution (option 1) when running implementation plans — dispatch a fresh subagent per task via the `superpowers:subagent-driven-development` skill.
