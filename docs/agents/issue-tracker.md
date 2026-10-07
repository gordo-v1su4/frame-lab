# Issue tracker: Linear

Specs, tickets, and triage for **Frame Lab** live in **Linear** (team **V1su4**), project **[Frame Lab](https://linear.app/v1su4/project/frame-lab-6dd41597bb31)**.

GitHub (`gordo-v1su4/frame-lab`) is for **code and PRs only** — not the issue tracker.

## Access

- **Workspace:** [linear.app/v1su4](https://linear.app/v1su4)
- **Team:** V1su4 (issue prefix `V1S-`)
- **Project:** Frame Lab (formerly Zig Swap)
- **Agent tooling:** Linear MCP (`plugin-linear-linear`) — authenticated in Cursor

## Conventions

- **Create an issue:** `save_issue` with `team: "V1su4"`, `project: "Frame Lab"`, `title`, `description` (Markdown).
- **Read an issue:** `get_issue` with id or identifier (e.g. `V1S-123`).
- **List issues:** `list_issues` with `team: "V1su4"`, `project: "Frame Lab"`, optional `label: "ready-for-agent"`.
- **Comment:** `save_comment` on the issue id.
- **Apply labels:** `save_issue` with `addLabels: ["ready-for-agent"]` (or `labels` to replace full set).
- **Close / state:** `save_issue` with `state: "Done"` or `state: "Canceled"`.
- **Blocking edges:** `save_issue` with `blockedBy: ["V1S-10"]` (native Linear blocking).
- **Link to GitHub:** `save_issue` `links: [{ url, title }]` for PRs, commits, or repo docs.

## When a skill says "publish to the issue tracker"

Create a Linear issue in project **Frame Lab** (formerly Zig Swap) via `save_issue`.

For specs from `/to-spec`: apply label **`ready-for-agent`**.

For tickets from `/to-tickets`: publish in dependency order (blockers first); set **`blockedBy`** on each issue; apply **`ready-for-agent`**.

## When a skill says "fetch the relevant ticket"

`get_issue` on the Linear identifier (e.g. `V1S-42`) and `list_comments` if thread context is needed.

## Triage labels

See `docs/agents/triage-labels.md`. Labels exist on team V1su4:

- `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`

## Wayfinding operations

Used by `/wayfinder`. The **map** is a parent issue; **child tickets** are sub-issues.

- **Map:** one issue labelled `wayfinder:map` (create label if missing) with Notes / Decisions-so-far / Fog in the body.
- **Child ticket:** `save_issue` with `parentId` set to the map issue; label `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking:** `blockedBy` on child issues (preferred) or explicit "Blocked by: V1S-n" in description.
- **Frontier:** `list_issues` open children of the map; drop any with open blockers or assignee.
- **Claim:** `save_issue` with `assignee: "me"`.
- **Resolve:** comment with answer, `state: "Done"`, append decision pointer to map description.

## Pull requests

PRs stay on GitHub. Link PRs to Linear issues via `links` or Linear's GitHub integration if enabled. External PRs are **not** a triage surface for Frame Lab.

## Hands-off agent loop

See **`docs/agents/automation.md`**. Operator assigns frontier tickets (`ready-for-agent`, no blockers). Agents run one ticket per session via `/implement`. Parent spec: **V1S-69**.
