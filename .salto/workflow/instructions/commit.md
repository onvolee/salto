# Commit Instruction

Purpose: turn the agent's completed workspace changes into a clean GitButler
commit on the workflow stage.

Use this instruction when the workflow reaches the commit phase. Do not use raw
`git add`, `git commit`, `git push`, `git checkout`, `git merge`, or
`git rebase`.

## Inputs

- `stage`: workflow stage name. In GitButler CLI commands this is the target
  branch/stack name passed to `but commit`.
- `change_scope`: which dirty files or hunks belong to this commit.
- `commit_context`: short summary of the intent, risk, and user request.

## Rules

1. Use the GitButler CLI skill for all version-control operations.
2. Use `/caveman-commit` to generate the commit message.
3. Commit only changes that belong to this workflow run.
4. Keep unrelated dirty files or hunks uncommitted.
5. Prefer selected change IDs from `but diff`; use `but status -fv` only when
   file-level commit placement or existing commit details are needed.
6. If the desired and undesired edits are in the same hunk, stop and report the
   ambiguity unless the user has explicitly allowed editing the working tree to
   isolate the hunk.

## Procedure

1. Inspect candidate changes:

   ```bash
   but diff
   ```

2. Select the file or hunk IDs that belong to this workflow run.

   - Whole file: use the file ID from `but diff`.
   - Single hunk: use `<file-id>:<hunk-id>`.
   - Never invent IDs or line-range IDs.

3. Generate a commit message with `/caveman-commit`.

   Commit message format:

   ```text
   type(scope): imperative summary
   ```

   Add a body only when the reason is not obvious, when there is a migration,
   a security fix, a breaking change, or a revert.

4. Commit to the target workflow stage.

   For a new branch:

   ```bash
   but commit <stage> -c -m "<commit-message>" --changes <ids>
   ```

   For an existing branch:

   ```bash
   but commit <stage> -m "<commit-message>" --changes <ids>
   ```

5. Read the command output as the source of truth for the new workspace state.

   - If all intended changes were committed, continue to the PR instruction.
   - If intended changes remain uncommitted, inspect whether GitButler reported
     dependency locking or branch placement issues before trying another commit.
   - If the branch is marked `merged upstream`, do not commit to it. Run the PR
     sync path or create/use a different branch.

## Output

Report:

- stage/branch name
- commit message
- committed change IDs
- any intentionally uncommitted changes
