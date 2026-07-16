# Salto GitHub Workflow

Purpose: give agents a repeatable path from completed code changes to a merged
GitHub pull request while using GitButler for local version-control state.

This workflow composes the instruction files in this directory:

- `instructions/commit.md`
- `instructions/pr.md`

## Trigger

Run this workflow when the user asks the agent to finish, ship, publish, open a
PR, or otherwise move completed local changes through GitHub.

Do not run this workflow for investigation-only tasks, code review, diagnosis,
or planning unless the user explicitly asks for commits or PRs.

## Operating Rules

1. Use GitButler (`but`) for local version-control inspection and writes.
2. Do not use raw git write commands.
3. Commit only this workflow run's intended changes.
4. Preserve unrelated user or agent changes.
5. Prefer non-interactive commands; never rely on an editor prompt.
6. Stop before risky or surprising actions, especially conflicts, ambiguous
   hunk selection, failed checks, missing auth, or another agent's branch.

## Workflow

1. Confirm scope.

   Identify the finished changes, the intended branch name, and whether the user
   expects a PR merge. If scope is ambiguous, ask before committing.

2. Inspect changes.

   Use the commit instruction's inspection path:

   ```bash
   but diff
   ```

   Select only the file or hunk IDs that belong to this workflow run.

3. Commit to the workflow stage.

   Follow `instructions/commit.md`.

   Summary:

   ```text
   /caveman-commit -> but commit <stage> [-c] -m "<msg>" --changes <ids>
   ```

4. Create, merge, and sync the PR.

   Follow `instructions/pr.md`.

   Summary:

   ```text
   but pr new <branch> -F <pr-message-file>
   gh pr merge <pr> --merge --delete-branch
   but pull --check
   but pull
   ```

5. Report the result.

   Include:

   - branch name
   - commit message
   - PR URL
   - merge strategy
   - sync result
   - anything left uncommitted or blocked

## Default Branch Naming

Use a dedicated GitButler branch per agent session.

Default format:

```text
<agent-name>/<short-description>
```

Example:

```text
codex/update-github-workflow
```

## Default PR Shape

Title:

```text
<type>(<scope>): <summary>
```

Body:

```markdown
## Summary

- What changed
- Why it changed

## Verification

- Command or check performed
```

Keep the body short. Do not include AI attribution unless the repository rules
explicitly require it.

## Graph Expectations

With the default `--merge` strategy, GitHub creates a merge commit on the target
branch:

```text
A---B-----------M  main
     \         /
      C-------D    feature branch
```

After `but pull`, GitButler syncs the local workspace to the merged target state.
The already-merged GitHub history is not rewritten by the sync step.

If `merge_strategy` is changed:

```text
Squash: A---B---S        main
Rebase: A---B---C'---D'  main
```

## Blockers

Stop and report instead of guessing when:

- selected changes cannot be separated cleanly
- `but commit` leaves intended changes uncommitted
- branch is marked `merged upstream`
- `but pr new` cannot authenticate with the forge
- `gh pr merge` is blocked by checks, reviews, or branch rules
- `but pull --check` reports conflicts
- the update would affect another agent's branch
