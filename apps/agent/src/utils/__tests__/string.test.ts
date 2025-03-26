import { describe, expect, it } from 'vitest'
import {
  convertArrayToMarkdownTableList,
  convertNestedArrayToTreeList,
  escapeSpecialCharactersForMarkdown,
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
