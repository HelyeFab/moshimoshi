# Codex Session Migration

## Where Codex conversations are stored

Codex conversations are **not** stored inside the `moshimoshi` repo.

They are stored in Codex's **global state directory** under your home folder:

- `~/.codex/sessions/`
- `~/.codex/state_5.sqlite`
- `~/.codex/state_5.sqlite-wal`
- `~/.codex/state_5.sqlite-shm`

Related global files that may also matter:

- `~/.codex/history.jsonl`
- `~/.codex/config.toml`
- `~/.codex/auth.json`

## How `codex resume` knows which conversations belong to a project

Codex feels project-aware because each saved thread stores the **working directory path** it was created from.

The global SQLite thread index stores metadata like:

- `id`
- `cwd`
- `title`
- `rollout_path`

The actual conversation content lives in JSONL rollout files under:

- `~/.codex/sessions/YYYY/MM/DD/rollout-...jsonl`

The SQLite DB links a thread to its rollout file and original project path.

So when you run:

```bash
codex resume
```

from:

```bash
/home/helye/DevProjects/nextjs/moshimoshi
```

Codex can filter to threads whose saved `cwd` matches that project path.

That is why:

- in `moshimoshi`, resume shows `moshimoshi`-relevant conversations
- in another project folder, resume shows the other project's conversations

## What happens on another machine

### Case 1: same absolute paths on the new machine

Example:

- old: `/home/helye/DevProjects/nextjs/moshimoshi`
- new: `/home/helye/DevProjects/nextjs/moshimoshi`

This is the best case.

If you copy the Codex global state and preserve the same project paths, then:

- `codex resume` should work naturally
- project filtering should feel the same as it does now

### Case 2: different absolute paths on the new machine

Example:

- old: `/home/helye/DevProjects/nextjs/moshimoshi`
- new: `/Users/helye/projects/moshimoshi`

In this case, the conversations are still present, but the saved `cwd` values no longer match the new folder path.

That means:

- `codex resume` may not show the expected sessions by default
- `codex resume --all` should still show them
- `codex resume <SESSION_ID>` should still work

So the conversations are not lost. The default per-project filtering is what becomes less useful.

## Key conclusion

Codex does **not** associate sessions to a project using repo-local files.

It associates them globally, primarily by:

- the saved thread metadata in `~/.codex/state_5.sqlite`
- especially the stored absolute `cwd`
- and the rollout files in `~/.codex/sessions/`

## 1. Exact files to copy

Minimum recommended files for preserving resume/history:

```text
~/.codex/sessions/
~/.codex/state_5.sqlite
~/.codex/state_5.sqlite-wal
~/.codex/state_5.sqlite-shm
```

Recommended extras:

```text
~/.codex/history.jsonl
~/.codex/config.toml
~/.codex/auth.json
~/.codex/logs_1.sqlite
~/.codex/logs_1.sqlite-wal
~/.codex/logs_1.sqlite-shm
```

If you want the new machine to behave as similarly as possible, copy the whole directory:

```text
~/.codex/
```

## 2. Safest migration command

Best practice:

1. Close Codex on the source machine first.
2. Copy the global state only after Codex is no longer writing to SQLite.

If you can use the same username/home layout on the new machine, the simplest option is:

```bash
rsync -av --progress ~/.codex/ user@new-machine:~/.codex/
```

If you only want the essential session data:

```bash
rsync -av --progress \
  ~/.codex/sessions/ \
  ~/.codex/state_5.sqlite \
  ~/.codex/state_5.sqlite-wal \
  ~/.codex/state_5.sqlite-shm \
  ~/.codex/history.jsonl \
  ~/.codex/config.toml \
  ~/.codex/auth.json \
  user@new-machine:~/.codex/
```

If the destination `.codex` directory does not exist yet:

```bash
ssh user@new-machine 'mkdir -p ~/.codex'
```

### Tarball backup alternative

If you prefer a single archive file instead of `rsync`, create a tarball on the old machine:

```bash
tar -czf ~/codex-backup-$(date +%F).tar.gz -C ~ .codex
```

This creates a backup like:

```text
~/codex-backup-2026-03-30.tar.gz
```

To restore it on the new machine:

```bash
tar -xzf ~/codex-backup-2026-03-30.tar.gz -C ~
```

Use this only while Codex is closed, so the copied SQLite and session files are consistent.

## 3. Optional SQLite path remap

Only do this if:

- you already copied the sessions successfully
- the new machine uses different absolute project paths
- and you want `codex resume` to regain normal per-project filtering without using `--all`

### Example

Old path:

```text
/home/helye/DevProjects/nextjs/moshimoshi
```

New path:

```text
/Users/helye/projects/moshimoshi
```

On the new machine, after copying `~/.codex`, you can update the stored `cwd` values:

```bash
sqlite3 ~/.codex/state_5.sqlite <<'SQL'
UPDATE threads
SET cwd = REPLACE(
  cwd,
  '/home/helye/DevProjects/nextjs/moshimoshi',
  '/Users/helye/projects/moshimoshi'
)
WHERE cwd LIKE '/home/helye/DevProjects/nextjs/moshimoshi%';
SQL
```

If you need to remap multiple project roots, run one `UPDATE` per root.

### Important caution

Do this only when Codex is closed on the new machine.

If SQLite WAL files exist and were copied too, it is safest to keep the copied set together:

- `state_5.sqlite`
- `state_5.sqlite-wal`
- `state_5.sqlite-shm`

Then run the update with Codex closed.

## Practical recommendation

The smoothest migration is:

1. Copy the entire `~/.codex/` directory.
2. Keep the same project paths on the new machine if possible.
3. If paths differ, use `codex resume --all` first.
4. If needed, remap `cwd` values in `state_5.sqlite`.

## Summary

- Codex conversation history is stored globally, not inside `moshimoshi`
- `codex resume` uses global thread metadata plus saved rollout JSONL files
- per-project behavior comes mainly from the stored `cwd`
- identical paths across machines make migration seamless
- different paths still preserve history, but may require `--all` or a SQLite path remap

## Migration Checklist

Use this exact order for the safest move:

1. Close all running Codex sessions on the old machine.
2. Confirm Codex is no longer writing to `~/.codex/`.
3. Copy `~/.codex/` to the new machine.
4. Restore your project repos on the new machine.
5. If possible, keep the same absolute project paths as the old machine.
6. Start in the target project directory on the new machine.
7. Run:

```bash
codex resume
```

8. If the expected sessions do not appear, run:

```bash
codex resume --all
```

9. If sessions appear under `--all` but not in the project-specific picker, remap `cwd` values in `~/.codex/state_5.sqlite`.
10. After remapping, rerun:

```bash
codex resume
```

11. Only after resume looks correct, reopen normal day-to-day Codex workflows.
