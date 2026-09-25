// Files every issue draft in .github/ISSUE_TEMPLATE as a real GitHub issue.
//
// A draft is a .md template whose frontmatter has a real `title`. Placeholder
// templates ("[Bug] "), issue forms (.yml) and config.yml are left alone, so
// the bug/feature templates contributors pick from keep working as before.
//
// Idempotent: an issue is matched first by a hidden marker this script writes,
// then by title across open AND closed issues, so drafts that were already
// filed by hand are never filed twice.
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const MARKER_RE = /<!--\s*issue-sync:\s*file=(\S+)\s+sha=([0-9a-f]+)\s*-->/
const LABEL_COLOR = 'ededed'

// ---------- parsing ----------

function unquote(s) {
  s = s.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function parseList(value) {
  const v = value.trim()
  const inner = v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1) : v
  return inner.split(',').map(unquote).filter(Boolean)
}

// Minimal frontmatter reader: `key: value`, inline lists and `- item` lists.
function parseTemplate(text) {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return null
  const meta = {}
  let listKey = null
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && listKey) { meta[listKey].push(unquote(item[1])); continue }
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/)
    if (!kv) continue
    const [, key, raw] = kv
    if (raw.trim() === '') { meta[key] = []; listKey = key; continue }
    listKey = null
    meta[key] = ['labels', 'assignees'].includes(key) ? parseList(raw) : unquote(raw)
  }
  for (const k of ['labels', 'assignees']) {
    if (typeof meta[k] === 'string') meta[k] = parseList(meta[k])
    if (!Array.isArray(meta[k])) meta[k] = []
  }
  return { meta, body: m[2].trim() }
}

// "[Bug] " and friends are fill-in-the-blank templates, not issues.
function isDraft(meta) {
  const title = typeof meta.title === 'string' ? meta.title.trim() : ''
  if (!title) return false
  if (/^\[[^\]]*\]:?$/.test(title)) return false
  if (String(meta['issue-sync']).toLowerCase() === 'false') return false
  return true
}

const normalizeTitle = (t) => t.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12)

function loadDrafts(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .sort()
    .flatMap((file) => {
      const parsed = parseTemplate(fs.readFileSync(path.join(dir, file), 'utf8'))
      if (!parsed || !isDraft(parsed.meta)) return []
      const { meta, body } = parsed
      const hash = sha(JSON.stringify([meta.title, meta.labels, body]))
      return [{
        file,
        hash,
        title: meta.title.trim(),
        labels: meta.labels,
        assignees: meta.assignees,
        body: `${body}\n\n<!-- issue-sync: file=${file} sha=${hash} -->\n`,
      }]
    })
}

// ---------- planning (pure, no API calls) ----------

function plan(drafts, issues) {
  const byFile = new Map()
  const byTitle = new Map()
  for (const issue of issues) {
    const m = (issue.body || '').match(MARKER_RE)
    if (m && !byFile.has(m[1])) byFile.set(m[1], { issue, hash: m[2] })
    const key = normalizeTitle(issue.title)
    if (!byTitle.has(key)) byTitle.set(key, issue)
  }

  const actions = []
  const seenTitles = new Set()
  for (const d of drafts) {
    const tkey = normalizeTitle(d.title)
    if (seenTitles.has(tkey)) {
      actions.push({ type: 'skip', draft: d, reason: 'same title as another draft' })
      continue
    }
    seenTitles.add(tkey)

    const tracked = byFile.get(d.file)
    if (tracked) {
      const { issue, hash } = tracked
      if (hash === d.hash) actions.push({ type: 'skip', draft: d, issue, reason: 'up to date' })
      else if (issue.state !== 'open') actions.push({ type: 'skip', draft: d, issue, reason: 'changed, but issue is closed' })
      else actions.push({ type: 'update', draft: d, issue })
      continue
    }
    const existing = byTitle.get(tkey)
    if (existing) {
      actions.push({ type: 'skip', draft: d, issue: existing, reason: `already filed (${existing.state})` })
      continue
    }
    actions.push({ type: 'create', draft: d })
  }
  return actions
}

// ---------- execution ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const labelName = (l) => (typeof l === 'string' ? l : l.name)

// GitHub allows ~80 content-generating requests a minute; a wave of drafts can
// be 70+ issues, so leave room rather than run right at the edge.
async function run({ github, context, core, dryRun = false, dir = '.github/ISSUE_TEMPLATE', delayMs = 1500 }) {
  const { owner, repo } = context.repo
  const drafts = loadDrafts(dir)
  core.info(`${drafts.length} issue draft(s) in ${dir}`)
  if (drafts.length === 0) return []

  const issues = (await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: 'all', per_page: 100,
  })).filter((i) => !i.pull_request)

  const actions = plan(drafts, issues)
  const writes = actions.filter((a) => a.type !== 'skip')

  if (!dryRun && writes.length) {
    const have = new Set((await github.paginate(github.rest.issues.listLabelsForRepo, {
      owner, repo, per_page: 100,
    })).map((l) => l.name.toLowerCase()))
    for (const name of new Set(writes.flatMap((a) => a.draft.labels))) {
      if (have.has(name.toLowerCase())) continue
      await github.rest.issues.createLabel({ owner, repo, name, color: LABEL_COLOR })
      have.add(name.toLowerCase())
      core.info(`created label "${name}"`)
    }
  }

  for (const a of actions) {
    const d = a.draft
    if (a.type === 'skip') {
      core.info(`skip    ${d.file} - ${a.reason}${a.issue ? ` (#${a.issue.number})` : ''}`)
      continue
    }
    if (dryRun) { core.info(`would ${a.type} ${d.file} -> "${d.title}"`); continue }

    if (a.type === 'create') {
      const { data } = await github.rest.issues.create({
        owner, repo, title: d.title, body: d.body, labels: d.labels, assignees: d.assignees,
      })
      a.issue = data
      core.info(`created ${d.file} -> #${data.number}`)
    } else {
      // Add labels, never remove: labels applied in the GitHub UI are kept.
      const labels = [...new Set([...a.issue.labels.map(labelName), ...d.labels])]
      await github.rest.issues.update({
        owner, repo, issue_number: a.issue.number, title: d.title, body: d.body, labels,
      })
      core.info(`updated ${d.file} -> #${a.issue.number}`)
    }
    await sleep(delayMs) // stay under GitHub's content-creation rate limit
  }

  const count = (t) => actions.filter((a) => a.type === t).length
  await core.summary
    .addHeading(`Issue sync${dryRun ? ' (dry run)' : ''}`)
    .addRaw(`${count('create')} to create, ${count('update')} to update, ${count('skip')} unchanged\n\n`)
    .addTable([
      [{ data: 'Template', header: true }, { data: 'Action', header: true }, { data: 'Issue', header: true }],
      ...actions.map((a) => [
        a.draft.file,
        a.type === 'skip' ? `skip: ${a.reason}` : (dryRun ? `would ${a.type}` : a.type),
        a.issue ? `#${a.issue.number}` : '',
      ]),
    ])
    .write()
  return actions
}

module.exports = run
Object.assign(module.exports, { parseTemplate, isDraft, loadDrafts, plan, normalizeTitle })
