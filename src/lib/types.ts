export type SegmentKind = 'heading' | 'paragraph' | 'code' | 'link' | 'variable'
export type SegmentStatus = 'draft' | 'needs-work' | 'confirmed' | 'returned'
export type IssueType = 'missing-translation' | 'missing-variable' | 'link-mismatch' | 'glossary' | 'code-format'
export type IssueSeverity = 'error' | 'warning'

export interface Segment {
  id: string
  index: number
  kind: SegmentKind
  sourceText: string
  targetText: string
  status: SegmentStatus
  protectedTokens: string[]
  note: string
}

export interface GlossaryTerm {
  id: string
  source: string
  target: string
  caseSensitive: boolean
  note: string
}

export interface Discussion {
  id: string
  segmentId: string
  author: string
  body: string
  resolved: boolean
  createdAt: number
}

export interface TranslationIssue {
  id: string
  segmentId: string
  type: IssueType
  severity: IssueSeverity
  message: string
  expected?: string
}

export interface CheckBatch {
  id: string
  /** 触发检查时正文与术语表的内容版本指纹 */
  contentVersion: string
  checkedAt: number
  issues: TranslationIssue[]
  issueCount: number
  /** 本次检查覆盖的片段数，便于区分“检查通过”与“未检查” */
  segmentCount: number
}

export interface HistoryEntry {
  id: string
  /** 文档级动作（如 check、import）使用 DOCUMENT_SCOPE */
  segmentId: string
  author: string
  action: 'edit' | 'confirm' | 'return' | 'resolve-conflict' | 'import' | 'discussion' | 'check'
  before: string
  after: string
  createdAt: number
  /** check 动作：本次批次绑定的内容版本与问题数；是否过期由渲染时实时比对 */
  checkContentVersion?: string
  checkIssueCount?: number
}

export const DOCUMENT_SCOPE = '__document__'

export interface TranslationConflict {
  id: string
  segmentId: string
  localText: string
  remoteText: string
  remoteAuthor: string
  createdAt: number
}

export interface LocalizationDocument {
  id: string
  title: string
  sourceFile: string
  sourceLanguage: string
  targetLanguage: string
  updatedAt: number
  segments: Segment[]
  glossary: GlossaryTerm[]
  discussions: Discussion[]
}
