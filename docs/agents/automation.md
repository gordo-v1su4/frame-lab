# Hands-off automation

Linear is the **control plane**. Code lives on GitHub. Agents never use GitHub Issues for Frame Lab work.

## Quick start (operator)

1. Open [Frame Lab in Linear](https://linear.app/v1su4/project/frame-lab-6dd41597bb31)
2. Find a ticket labelled **`ready-for-agent`** with no blockers (frontier)
3. Start a **fresh** Cursor or Codex session: *"Implement Linear issue V1S-NNN"*
4. Agent runs `/implement`, opens PR, comments brief, marks **Done**
5. Repeat

## Assigning work to an agent

| Intent | Linear action |
|--------|----------------|
| Ready for AFK agent | Label `ready-for-agent`, state **Todo** |
| Blocked | Set `blockedBy` to blocking issue(s) |
| Human only | Label `ready-for-human`, remove `ready-for-agent` |
| Claim (human) | Assignee → you |

To tell Hermes / the agent "do the next task": ensure the next frontier ticket has `ready-for-agent` and no open blockers — no special assignee required.

## Frontier (what "next" means)

An issue is on the **frontier** when:

- Label includes `ready-for-agent`
- State is not Done/Canceled
- Every issue in `blockedBy` is Done

Agents must not skip blockers.

## Skills chain

| Step | Skill |
|------|--------|
| Shape idea | `/grill-with-docs` |
| Publish plan | `/to-spec` → Linear |
| Split work | `/to-tickets` → Linear with `blockedBy` |
| Execute one ticket | `/implement` (uses `/tdd`, `/code-review`) |
| Loop design | `/loop-me` → `workflows/*.md` |

Full loop spec: [`workflows/agent-automation-loop.md`](../../workflows/agent-automation-loop.md)

## Graft in agent sessions

Indexed under `graft/` (local, gitignored). Prefer CLI before reading raw source:

```bash
graft map
graft ask "where is the chop reducer tested?" --source
graft grep "TimeSampler" --in core/
```

Ticket **V1S-*** (Graft smoke test) validates tooling when the repo gains source files.

## Codex

Point Codex at the same Linear issue + repo. Same ADRs, same bun/uv/zig toolchain. PRs link back to Linear via issue comments.
