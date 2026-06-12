---
name: commit-and-changeset-message
description: Generate a Conventional Commit message and a changeset summary candidate from staged changes.
argument-hint: "[optional changes intent, e.g. This internal-looking refactor improves plugin loading performance.]"
agent: agent
model: Auto
---

Generate a commit message candidate and a changeset summary candidate for the current staged changes.

# Scope

Use only the current staged changes as the code-change scope.

Do not include unstaged changes or untracked files.

This prompt is for message drafting only.

Do not:

- run `git commit`
- run `changeset add`
- create files
- edit files
- stage or unstage files

# Changes intent

The following text is optional author-provided context.

Use it as the primary source for the purpose and user-facing impact of the change when it is provided.

If it is empty, missing, or equivalent to `None`, infer the intent only from the staged changes.

If the changes intent is fewer than 5 words and does not describe a purpose or impact (for example: `TODO`, `.`, `test`), treat it as absent and infer intent only from the staged changes.

Do not invent user-facing impact that is not supported by the staged changes or by this intent.

Changes intent:

```text
${input:changesIntent:None}
```

# Output format

Return exactly the following sections.

## Commit message

```text
<subject>

<body>
```

## Changeset summary candidate

```text
Status: <one of: release-note candidate | no user-facing summary | uncertain>

Summary:
<summary or "No user-facing release note candidate.">

Note:
<include only when Status is uncertain; omit this field for release-note candidate and no user-facing summary>
```

# Commit message rules

Use Conventional Commits style.

- Use `<type>(<scope>): <description>` when a clear scope exists.
- Use `<type>: <description>` when no clear scope exists.
- Choose the type from common Conventional Commit types such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, or `build`.
- Write a concise subject.
- Write the body as one to three short paragraphs of prose that explain what changed and why.
- When the changes intent is absent and the staged changes do not reveal motivation, describe only what changed and omit speculation about why.
- Always include both subject and body.
- The commit message may include implementation details when they help future maintainers understand the change.

# Changeset summary rules

The changeset summary candidate is for release notes and package users, not for repository maintainers.

Always output the `Changeset summary candidate` section.

If the staged changes have a meaningful package-user-facing impact, write a release-note-oriented summary using exactly one of these category tags:

- [Added]
- [Changed]
- [Deprecated]
- [Removed]
- [Fixed]
- [Security]

If there is no meaningful package-user-facing impact, do not force a category.

Use this output instead:

```text
Status: no user-facing summary

Summary:
No user-facing release note candidate.
```

If the package-user-facing impact is unclear, use:

```text
Status: uncertain

Summary:
<best candidate if possible, or "No clear release note candidate.">

Note:
<what needs human judgment>
```

Only mention security, performance, compatibility, or breaking changes when they are clearly supported by the staged changes or explicitly stated in the changes intent.

Do not include changeset frontmatter.

Do not decide package names.

Do not decide SemVer bump types.

# Quality requirements

- Do not make the commit message and changeset summary identical.
- The commit message is maintainer-oriented.
- The changeset summary is release-note-oriented and package-user-oriented.
- Do not use commit-oriented prefixes such as `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, or `ci:` in the changeset summary.
- Prefer a single concise changeset summary sentence.
- If the diff and the changes intent conflict, use the diff as the authoritative source for what the code does and use the changes intent as the authoritative source for why it was done.
- If the diff and the changes intent conflict, set the changeset Status to `uncertain` and describe the conflict in the changeset Note field.
