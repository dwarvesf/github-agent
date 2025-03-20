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
