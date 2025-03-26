import { describe, expect, it } from 'vitest'
import {
  convertArrayToMarkdownTableList,
  convertNestedArrayToTreeList,
  escapeSpecialCharactersForMarkdown,
  prTitleFormatValid,
} from '../string'

describe('escapeSpecialCharactersForMarkdown', () => {
  it('should escape special characters in markdown', () => {
    const input = '*_#`-+.![]()\\test\nline'
    const expected = '\\*\\_\\#\\`\\-\\+\\.\\!\\[\\]\\(\\)\\\\test\\nline'
    expect(escapeSpecialCharactersForMarkdown(input)).toBe(expected)
  })

  it('should handle empty string', () => {
    expect(escapeSpecialCharactersForMarkdown('')).toBe('')
  })

  it('should handle string with no special characters', () => {
    const input = 'normal text'
    expect(escapeSpecialCharactersForMarkdown(input)).toBe(input)
  })
})

describe('convertArrayToMarkdownTableList', () => {
  it('should convert array to markdown table list with same width labels', () => {
    const input = [
      { label: 'name', value: 'John' },
      { label: 'age', value: 25 },
      { label: 'city', value: 'New York' },
    ]
    const expected = '`name: `  John\n`age:  `  25\n`city: `  New York\n'
    expect(convertArrayToMarkdownTableList(input)).toBe(expected)
  })

  it('should convert array to markdown table list without same width labels', () => {
    const input = [
      { label: 'name', value: 'John' },
      { label: 'age', value: 25 },
    ]
    const expected = '`name:`  John\n`age:`  25\n'
    expect(convertArrayToMarkdownTableList(input, false)).toBe(expected)
  })

  it('should handle empty array', () => {
    expect(convertArrayToMarkdownTableList([])).toBe('')
  })
})

describe('convertNestedArrayToTreeList', () => {
  it('should convert single node without children', () => {
    const input = { label: 'Root' }
    expect(convertNestedArrayToTreeList(input)).toBe('Root')
  })

  it('should convert node with single level of children', () => {
    const input = {
      label: 'Root',
      children: [{ label: 'Child 1' }, { label: 'Child 2' }],
    }
    const expected = 'Root\n∟ Child 1\n∟ Child 2'
    expect(convertNestedArrayToTreeList(input)).toBe(expected)
  })

  it('should convert deeply nested tree', () => {
    const input = {
      label: 'Root',
      children: [
        {
          label: 'Child 1',
          children: [{ label: 'Grandchild 1' }],
        },
        { label: 'Child 2' },
      ],
    }
    const expected = 'Root\n∟ Child 1\n  ∟ Grandchild 1\n∟ Child 2'
    expect(convertNestedArrayToTreeList(input)).toBe(expected)
  })
})

describe('prTitleFormatValid', () => {
  it('valid formats', () => {
    expect(prTitleFormatValid('feat: add login feature')).toBe(true)
    expect(prTitleFormatValid('fix(parser): resolve issue')).toBe(true)
    expect(prTitleFormatValid('123(scope): numeric type')).toBe(true)
    expect(prTitleFormatValid('fix(scope-123): special chars')).toBe(true)
    expect(prTitleFormatValid('feat(verylongscope): long message')).toBe(true)
  })

  it('invalid formats', () => {
    expect(prTitleFormatValid('feat add login feature')).toBe(false)
    expect(prTitleFormatValid(': missing type')).toBe(false)
    expect(prTitleFormatValid('feat(scope)missing colon')).toBe(false)
    expect(prTitleFormatValid('feat() message')).toBe(false)
    expect(prTitleFormatValid(' feat: leading space')).toBe(false)
    expect(prTitleFormatValid('feat: trailing space ')).toBe(false)
    expect(prTitleFormatValid('fix(scope) :space before colon')).toBe(false)
    expect(prTitleFormatValid('')).toBe(false)
    expect(prTitleFormatValid('feat:')).toBe(false)
    expect(prTitleFormatValid('feat: ')).toBe(false)
    expect(prTitleFormatValid('feat(): message')).toBe(false)
    expect(prTitleFormatValid('(): message')).toBe(false)
    expect(prTitleFormatValid('feat(scope with space): valid')).toBe(false)
    expect(prTitleFormatValid('fix(scope!): invalid chars')).toBe(false)
    expect(prTitleFormatValid('fix(scope): multi: colon')).toBe(false)
    expect(prTitleFormatValid('fix(scope):')).toBe(false)
  })
})
