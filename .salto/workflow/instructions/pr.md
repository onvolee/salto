# PR Instruction

Purpose: publish the GitButler branch, create/update a pull request, merge it
with GitHub, then sync GitButler back to the target branch.

This instruction uses PR Scheme A:

```text
but pr new -> gh pr merge -> but pull --check -> but pull
```

Use this scheme when the user wants to preserve a GitHub PR record but does not
need a manual browser click to merge.

## Inputs

- `branch`: GitButler branch name or CLI ID.
- `target`: target branch, normally `main`.
- `title`: PR title.
- `body`: PR body.
- `merge_strategy`: one of `merge`, `squash`, or `rebase`; default `merge`.

## Preconditions

1. The branch has the intended commits and no required dirty changes are left.
2. GitHub CLI (`gh`) is authenticated for the repository.
3. The repository allows the selected merge strategy.
4. Any required checks or reviews are already satisfied, or the merge command
   will fail and the agent must report that blocker.
5. For stacked branches, create PRs with GitButler so stack metadata and bases
   stay correct.

## Procedure

1. Create a non-interactive PR with GitButler.

   Prefer a temporary PR message file so the command cannot open an editor.
   The first line is the PR title; the rest is the PR body:

   ```bash
   but pr new <branch> -F <pr-message-file>
   ```

   If the workflow intentionally wants GitButler's default PR content, use:

   ```bash
   but pr new <branch> -t
   ```

   Notes:

   - `but pr new` pushes the branch before creating the PR.
   - Do not run `but push` first.
   - Use `--format json` when the agent needs structured output.
   - Use `--draft` only when the user requested a draft PR or the workflow is
     configured to require draft PRs.

2. Extract the PR number or URL from the `but pr new` output.

3. Merge the PR with GitHub CLI.

   Merge commit, preserving the branch commits under a merge commit:

   ```bash
   gh pr merge <pr-number-or-url> --merge --delete-branch
   ```

   Squash merge:

   ```bash
   gh pr merge <pr-number-or-url> --squash --delete-branch
   ```

   Rebase merge:

   ```bash
   gh pr merge <pr-number-or-url> --rebase --delete-branch
   ```

4. Sync GitButler after the merge.

   ```bash
   but pull --check
   but pull
   ```

   Run `but pull` only if `but pull --check` reports a clean update. If it
   reports conflicts or would affect another agent's branch, stop and report the
   blocker.

## Failure Handling

- If `but pr new` fails because forge auth is missing, report the auth blocker.
- If `gh pr merge` fails because checks, reviews, or branch rules are pending,
  report the PR URL and the exact unmet requirement.
- If the PR already exists, reuse or update it rather than creating a duplicate.
- If branch deletion fails after merge, report it; do not use destructive git
  commands to clean it up.
- If `but pull --check` reports conflicts, do not run `but pull`. Ask for
  direction or resolve only if the user explicitly asked the agent to handle
  update conflicts.

## Output

Report:

- PR URL
- merge strategy used
- whether the remote branch was deleted
- whether GitButler sync completed
- any remaining blockers or manual follow-up
