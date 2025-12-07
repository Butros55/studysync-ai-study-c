import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
  compact?: boolean
  truncateLines?: number
  inline?: boolean
}

/**
 * Normalisiert Text für besseres Markdown/LaTeX-Rendering
 */
function normalizeContent(content: string): string {
  if (!content) return ''
  
  let processed = content
  
  // Liste aller LaTeX-Befehle
  const latexCommands = [
    // Funktionen
    'sqrt', 'frac', 'sum', 'prod', 'int', 'lim', 'log', 'ln', 'sin', 'cos', 'tan',
    // Griechisch
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'omega',
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Sigma', 'Omega', 'Pi',
    // Operatoren
    'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx', 'equiv',
    // Logik (WICHTIG!)
    'land', 'lor', 'lnot', 'not', 'neg', 'to', 'gets', 'implies', 'iff',
    'wedge', 'vee', 'oplus', 'otimes', 'odot',
    // Pfeile
    'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow', 'Leftarrow', 'Leftrightarrow',
    // Mengen
    'infty', 'partial', 'nabla', 'forall', 'exists', 'in', 'notin', 'subset', 'supset',
    'cup', 'cap', 'emptyset',
    // Formatierung
    'overline', 'underline', 'hat', 'bar', 'vec', 'tilde',
    'text', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'mathbb',
    // Klammern
    'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
    // Matrizen
    'binom', 'pmatrix', 'bmatrix', 'vmatrix', 'begin', 'end'
  ]
  
  // SCHRITT 1: Zeilen die LaTeX-Befehle enthalten aber keine $...$ haben
  // z.B. "y = \not a" oder "a \land b" oder "(x \lor \neg y)"
  const lines = processed.split('\n')
  const processedLines = lines.map(line => {
    // Wenn bereits $ enthält oder eine Überschrift ist, nicht verändern
    if (line.includes('$') || line.trim().startsWith('#') || line.trim().startsWith('```')) {
      return line
    }
    
    // Prüfe ob die Zeile einen LaTeX-Befehl enthält
    const hasLatex = latexCommands.some(cmd => line.includes('\\' + cmd))
    
    if (!hasLatex) return line
    
    // Die Zeile enthält LaTeX ohne $ - wir müssen sie wrappen
    const trimmed = line.trim()
    
    // Wenn es eine Gleichung ist (enthält =), behandle die rechte Seite
    if (trimmed.includes('=')) {
      const eqIndex = trimmed.indexOf('=')
      const lhs = trimmed.substring(0, eqIndex).trim()
      const rhs = trimmed.substring(eqIndex + 1).trim()
      
      // Prüfe ob die rechte Seite LaTeX enthält
      const rhsHasLatex = latexCommands.some(cmd => rhs.includes('\\' + cmd))
      
      if (rhsHasLatex) {
        // Wrappe die gesamte Gleichung
        return `$${lhs} = ${rhs}$`
      }
    }
    
    // Sonst wrappe die gesamte Zeile wenn sie mathematisch aussieht
    // (enthält LaTeX-Befehle und ist nicht zu lang)
    if (trimmed.length < 200) {
      return `$${trimmed}$`
    }
    
    return line
  })
  
  processed = processedLines.join('\n')
  
  // SCHRITT 2: Finde LaTeX-Befehle mit {} die noch nicht in $...$ sind
  // z.B. \sqrt{x} oder \frac{a}{b}
  for (const cmd of latexCommands) {
    // Muster: \command{...} nicht in $ eingeschlossen
    const pattern = new RegExp(
      '(?<!\\$[^\\n]*?)' +  // Nicht nach einem $ auf derselben Zeile
      '(\\\\' + cmd + '(?:\\{[^}]*\\})+)' +  // Der Befehl mit Argumenten
      '(?![^\\n]*?\\$)',  // Nicht vor einem $ auf derselben Zeile
      'g'
    )
    processed = processed.replace(pattern, ' $$$1$ ')
  }
  
  // SCHRITT 3: Konvertiere \begin{tabular} zu Markdown-Tabellen (nur außerhalb von $ Blöcken)
  // Nur tabular außerhalb von Math-Blöcken konvertieren
  processed = processed.replace(
    /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (match, tableContent: string) => {
      // Prüfe ob in einem Math-Block - wenn ja, nicht konvertieren
      const beforeMatch = processed.indexOf(match)
      const textBefore = processed.substring(0, beforeMatch)
      const dollarCount = (textBefore.match(/\$/g) || []).length
      // Ungerade Anzahl = wir sind in einem Math-Block
      if (dollarCount % 2 !== 0) return match
      
      const rows = tableContent
        .split('\\\\')
        .map(row => row.trim())
        .filter(row => row.length > 0 && row !== '\\hline')
        .map(row => {
          const cells = row.replace(/\\hline/g, '').split('&').map(cell => cell.trim())
          return '| ' + cells.join(' | ') + ' |'
        })
      
      if (rows.length === 0) return ''
      
      const colCount = rows[0].split('|').filter(c => c.trim()).length
      const separator = '|' + Array(colCount).fill('---').join('|') + '|'
      
      return '\n\n' + [rows[0], separator, ...rows.slice(1)].join('\n') + '\n\n'
    }
  )
  
  // SCHRITT 4: \begin{array} innerhalb von $$ ... $$ bleibt für KaTeX
  // Nur array AUSSERHALB von Math-Blöcken konvertieren
  // Dies ist ein einfacher Ansatz: Ersetze nur wenn NICHT in $$ eingeschlossen
  const arrayPattern = /\\\[?\s*\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}\s*\\\]?/g
  let lastIndex = 0
  let result = ''
  let match
  
  while ((match = arrayPattern.exec(processed)) !== null) {
    const textBefore = processed.substring(0, match.index)
    result += processed.substring(lastIndex, match.index)
    
    // Zähle $$ Paare bis zu diesem Punkt
    const doubleDollarPairs = (textBefore.match(/\$\$/g) || []).length
    const singleDollars = (textBefore.match(/\$/g) || []).length - (doubleDollarPairs * 2)
    
    // Wenn wir in einem $$ Block sind ODER in einem $ Block, lass KaTeX rendern
    if (doubleDollarPairs % 2 !== 0 || singleDollars % 2 !== 0) {
      // Belasse es für KaTeX
      result += match[0]
    } else {
      // Konvertiere zu Markdown-Tabelle
      const tableContent = match[1]
      const rows = tableContent
        .split('\\\\')
        .map((row: string) => row.trim())
        .filter((row: string) => row.length > 0 && row !== '\\hline')
        .map((row: string) => {
          const cells = row.replace(/\\hline/g, '').split('&').map((cell: string) => cell.trim())
          return '| ' + cells.join(' | ') + ' |'
        })
      
      if (rows.length > 0) {
        const colCount = rows[0].split('|').filter((c: string) => c.trim()).length
        const separator = '|' + Array(colCount).fill('---').join('|') + '|'
        result += '\n\n' + [rows[0], separator, ...rows.slice(1)].join('\n') + '\n\n'
      } else {
        result += match[0]
      }
    }
    
    lastIndex = match.index + match[0].length
  }
  result += processed.substring(lastIndex)
  processed = result
  
  // SCHRITT 5: Bereinige Tabellen - entferne alleinstehende |----| Zeilen
  const tableLines = processed.split('\n')
  const cleanedLines: string[] = []
  
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i]
    const trimmed = line.trim()
    
    // Prüfe ob es eine Separator-Zeile ist (nur |----|)
    if (/^\|[-:\s|]+\|$/.test(trimmed) && !trimmed.includes('|---')) {
      // Alleinstehender Separator ohne Inhalt - überspringen
      if (i === 0 || !tableLines[i-1].trim().startsWith('|')) {
        continue
      }
    }
    
    cleanedLines.push(line)
  }
  
  processed = cleanedLines.join('\n')
  
  // SCHRITT 6: Konvertiere einfache Potenzen zu LaTeX
  // z.B. "10^3" -> "$10^3$" (aber nicht wenn bereits in $)
  processed = processed.replace(
    /(?<!\$[^\n]*)(\d+)\^(\d+)(?![^\n]*\$)/g,
    (match, base, exp, offset) => {
      // Prüfe ob bereits in $...$ - einfache Heuristik
      const before = processed.substring(Math.max(0, offset - 50), offset)
      const after = processed.substring(offset, Math.min(processed.length, offset + 50))
      if (before.includes('$') && !before.includes('$$')) return match
      return `$${base}^{${exp}}$`
    }
  )
  
  // SCHRITT 6b: Konvertiere Subskripte zu LaTeX
  // z.B. "10110110_2" -> "$10110110_2$" (binäre Notation)
  // Unterstützt: number_number, letter_number, word_2 etc.
  processed = processed.replace(
    /(?<!\$)([A-Za-z0-9]+)_([0-9]+)(?!\$)/g,
    (match, base, subscript, offset) => {
      // Prüfe ob bereits in $...$
      const textBefore = processed.substring(Math.max(0, offset - 100), offset)
      const dollarCount = (textBefore.match(/\$/g) || []).length
      if (dollarCount % 2 !== 0) return match // Bereits in Math-Mode
      return `$${base}_{${subscript}}$`
    }
  )
  
  // SCHRITT 7: Bereinige doppelte $ Zeichen
  processed = processed.replace(/\$\s*\$/g, '')
  processed = processed.replace(/\$\$\$/g, '$$')
  processed = processed.replace(/\s+\$/g, ' $')
  processed = processed.replace(/\$\s+/g, '$ ')
  
  // SCHRITT 8: Bereinige übermäßige Zeilenumbrüche
  processed = processed.replace(/\n{3,}/g, '\n\n')
  
  return processed
}

export function MarkdownRenderer({ 
  content, 
  className = '', 
  compact = false,
  truncateLines,
  inline = false,
}: MarkdownRendererProps) {
  const normalizedContent = useMemo(() => normalizeContent(content), [content])

  // Prüfe ob scientific-content Klasse verwendet wird
  const isScientific = className.includes('scientific-content')

  const baseStyles = compact 
    ? 'prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-h3:text-sm prose-h3:font-semibold'
    : 'prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:my-3'

  // Keine Tailwind-Table-Styles bei wissenschaftlichem Content - CSS übernimmt
  const tableStyles = isScientific 
    ? '' 
    : 'prose-table:border-collapse prose-table:w-auto prose-table:my-2 prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-th:text-left prose-th:font-medium prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5'

  const truncateStyles = truncateLines 
    ? `line-clamp-${truncateLines} overflow-hidden` 
    : ''

  return (
    <div 
      className={cn(
        baseStyles,
        tableStyles,
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-md',
        truncateStyles,
        inline && 'inline',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false }]]}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

export const MarkdownText = MarkdownRenderer

export { normalizeContent as normalizeHandwritingOutput }
