import type { GlossaryTerm, Segment, SegmentKind, TranslationIssue } from './types'

const variablePattern = /\{\{[^{}]+\}\}|\{[A-Za-z_][\w.-]*\}|%\([^)]+\)[sd]|%[sd]/g
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g

export const unique = <T,>(items: T[]) => Array.from(new Set(items))
export const extractVariables = (text: string) => unique(text.match(variablePattern) ?? [])
export const extractLinks = (text: string) => unique(Array.from(text.matchAll(linkPattern), (match) => match[1]))
export const extractProtected = (text: string) => unique([...extractVariables(text), ...extractLinks(text)])

export const segmentKind = (text: string, fencedCode: boolean): SegmentKind => {
  if (fencedCode || /^ {4}\S/m.test(text)) return 'code'
  if (/^#{1,6}\s+/.test(text)) return 'heading'
  if (extractLinks(text).length) return 'link'
  if (extractVariables(text).length) return 'variable'
  return 'paragraph'
}

export const parseMarkdown = (markdown: string): Segment[] => {
  const normalized = markdown.replace(/\r/g, '')
  const blocks: { text: string; code: boolean }[] = []
  const codeFence = /```[\s\S]*?```/g
  let cursor = 0
  for (const match of normalized.matchAll(codeFence)) {
    const before = normalized.slice(cursor, match.index).split(/\n{2,}/).filter((part) => part.trim())
    blocks.push(...before.map((text) => ({ text: text.trim(), code: false })))
    blocks.push({ text: match[0].trim(), code: true })
    cursor = (match.index ?? 0) + match[0].length
  }
  blocks.push(...normalized.slice(cursor).split(/\n{2,}/).filter((part) => part.trim()).map((text) => ({ text: text.trim(), code: false })))
  return blocks.map((block, index) => ({
    id: `segment-import-${index + 1}`,
    index: index + 1,
    kind: segmentKind(block.text, block.code),
    sourceText: block.text,
    targetText: '',
    status: 'draft' as const,
    protectedTokens: extractProtected(block.text),
    note: '',
  }))
}

const meaningful = (text: string) => text.replace(/[#*_`>\s]/g, '').length > 1

export const analyzeSegment = (segment: Segment, glossary: GlossaryTerm[]): TranslationIssue[] => {
  const issues: TranslationIssue[] = []
  const sourceVariables = extractVariables(segment.sourceText)
  const targetVariables = extractVariables(segment.targetText)
  const sourceLinks = extractLinks(segment.sourceText)
  const targetLinks = extractLinks(segment.targetText)
  if (meaningful(segment.sourceText) && !segment.targetText.trim()) {
    issues.push({ id: `${segment.id}-missing`, segmentId: segment.id, type: 'missing-translation', severity: 'error', message: '译文为空，存在漏译。' })
  }
  const missingVariables = sourceVariables.filter((token) => !targetVariables.includes(token))
  if (missingVariables.length) {
    issues.push({ id: `${segment.id}-variable`, segmentId: segment.id, type: 'missing-variable', severity: 'error', message: `缺少变量占位符：${missingVariables.join('、')}`, expected: missingVariables.join(' ') })
  }
  const missingLinks = sourceLinks.filter((url) => !targetLinks.includes(url))
  if (missingLinks.length) {
    issues.push({ id: `${segment.id}-link`, segmentId: segment.id, type: 'link-mismatch', severity: 'warning', message: `链接目标不一致或缺失：${missingLinks.join('、')}`, expected: missingLinks.join(' ') })
  }
  for (const term of glossary) {
    const sourceHit = term.caseSensitive ? segment.sourceText.includes(term.source) : segment.sourceText.toLowerCase().includes(term.source.toLowerCase())
    if (sourceHit && segment.targetText && !segment.targetText.includes(term.target)) {
      issues.push({ id: `${segment.id}-term-${term.id}`, segmentId: segment.id, type: 'glossary', severity: 'warning', message: `术语“${term.source}”应译为“${term.target}”。`, expected: term.target })
    }
  }
  if (segment.kind === 'code' && segment.targetText && segment.sourceText !== segment.targetText) {
    issues.push({ id: `${segment.id}-code`, segmentId: segment.id, type: 'code-format', severity: 'error', message: '代码块应保持原样，不能翻译或改动格式。' })
  }
  return issues
}

export const analyzeDocument = (segments: Segment[], glossary: GlossaryTerm[]) =>
  segments.flatMap((segment) => segment.status === 'confirmed' ? [] : analyzeSegment(segment, glossary))

/** FNV-1a 32 位哈希，用于为正文/术语表内容生成稳定的短版本指纹 */
const fnv1a = (input: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 计算正文与术语表的内容版本：只要任一片段的源文/译文/状态，
 * 或术语条目发生变化，版本指纹就会改变；讨论不影响检查结果，不计入。
 */
export const contentFingerprint = (segments: Segment[], glossary: GlossaryTerm[]) => {
  const segmentPart = segments
    .map((segment) => [segment.id, segment.sourceText, segment.targetText, segment.status].join(''))
    .join('')
  const glossaryPart = glossary
    .map((term) => [term.id, term.source, term.target, term.caseSensitive ? '1' : '0'].join(''))
    .join('')
  return `seg-${fnv1a(segmentPart)}-glo-${fnv1a(glossaryPart)}`
}

export const renderTargetMarkdown = (segments: Segment[]) =>
  segments.map((segment) => segment.targetText || segment.sourceText).join('\n\n')
