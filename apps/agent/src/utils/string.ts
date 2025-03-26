export const escapeSpecialCharactersForMarkdown = (input: string): string => {
  return input
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/\*/g, '\\*') // Escape asterisks
    .replace(/\_/g, '\\_') // Escape underscores
    .replace(/\#/g, '\\#') // Escape hash symbols
    .replace(/\`/g, '\\`') // Escape backticks
    .replace(/\-/g, '\\-') // Escape hyphens
    .replace(/\+/g, '\\+') // Escape plus signs
    .replace(/\./g, '\\.') // Escape periods
    .replace(/\!/g, '\\!') // Escape exclamation marks
    .replace(/\[/g, '\\[') // Escape opening square brackets
    .replace(/\]/g, '\\]') // Escape closing square brackets
    .replace(/\(/g, '\\(') // Escape opening parentheses
    .replace(/\)/g, '\\)') // Escape closing parentheses
    .replace(/\n/g, '\\n') // Escape newlines
}

export const convertArrayToMarkdownTableList = (
  array: Array<{ label: string; value: string | number }>,
  sameWidthLabels: boolean = true,
): string => {
  const maxKeyLength = Math.max(...array.map(({ label }) => label.length))
  return array
    .map(({ label, value }) => {
      const padding = !sameWidthLabels
        ? ''
        : ' '.repeat(maxKeyLength - label.length + 1)
      return `\`${label}:${padding}\`  ${value}\n`
    })
    .join('')
}

interface TreeNode {
  label: string
  children?: TreeNode[]
}

export const convertNestedArrayToTreeList = (node: TreeNode): string => {
  const level = 0
  const result: string[] = []
  const traverse = (node: TreeNode, level: number) => {
    const padding = ' '.repeat(((level || 1) - 1) * 2)
    result.push(`${padding}${level > 0 ? '∟ ' : ''}${node.label}`)
    node.children?.forEach((child) => traverse(child, level + 1))
  }
  traverse(node, level)
  return result.join('\n')
}

export const getOneLineCommit = (originCommit: string): string => {
  const lines = originCommit.split('\n')

  return lines[0] || ''
}

export const prTitleFormatValid = (title: string): boolean => {
  const titleFormatRegex =
    /^[a-zA-Z0-9]+(\([a-zA-Z0-9\-_]+\))?: [a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$/
  return titleFormatRegex.test(title)
}
