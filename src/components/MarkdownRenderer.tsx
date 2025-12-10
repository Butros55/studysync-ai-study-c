import { useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'
import { Copy, Check } from '@phosphor-icons/react'
import { useState } from 'react'

// ============================================================================
// Syntax Highlighting für Code-Blöcke
// ============================================================================

const CODE_TOKENS: Record<string, { pattern: RegExp; className: string }[]> = {
  javascript: [
    { pattern: /\b(const|let|var|function|return|if|else|for|while|class|new|this|async|await|import|export|from|try|catch|throw|switch|case|break|continue|default)\b/g, className: 'text-purple-400' },
    { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: 'text-orange-400' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-400' },
    { pattern: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\b(console|Math|Array|Object|String|Number|Boolean|Date|JSON|Promise|Error)\b/g, className: 'text-cyan-400' },
    { pattern: /\.(log|error|warn|info|push|pop|map|filter|reduce|forEach|length|toString|includes|indexOf|slice|splice|concat|join|split|trim|replace)\b/g, className: 'text-blue-300' },
    { pattern: /(\=\>|===|!==|==|!=|>=|<=|\+\+|--|\+=|-=|\*=|\/=)/g, className: 'text-pink-400' },
  ],
  typescript: [], // Inherits from JS
  python: [
    { pattern: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|with|lambda|yield|raise|pass|break|continue|and|or|not|in|is|global|nonlocal)\b/g, className: 'text-purple-400' },
    { pattern: /\b(True|False|None)\b/g, className: 'text-orange-400' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, className: 'text-green-400' },
    { pattern: /#.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\b(print|len|range|str|int|float|list|dict|set|tuple|type|input|open|enumerate|zip|map|filter|sorted|reversed|sum|min|max|abs|round)\b/g, className: 'text-cyan-400' },
    { pattern: /@\w+/g, className: 'text-yellow-400' },
  ],
  java: [
    { pattern: /\b(public|private|protected|class|interface|extends|implements|static|final|void|return|if|else|for|while|new|this|super|try|catch|throw|throws|import|package|abstract|synchronized)\b/g, className: 'text-purple-400' },
    { pattern: /\b(true|false|null)\b/g, className: 'text-orange-400' },
    { pattern: /\b(\d+\.?\d*[fFdDlL]?)\b/g, className: 'text-amber-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\b(System|String|Integer|Double|Boolean|ArrayList|HashMap|Scanner|List|Map|Set|Object)\b/g, className: 'text-cyan-400' },
    { pattern: /@\w+/g, className: 'text-yellow-400' },
  ],
  c: [
    { pattern: /\b(int|char|float|double|void|return|if|else|for|while|do|switch|case|break|continue|struct|typedef|sizeof|const|static|extern|unsigned|signed|long|short)\b/g, className: 'text-purple-400' },
    { pattern: /\b(\d+\.?\d*[fFlL]?)\b/g, className: 'text-amber-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /#\s*(include|define|ifdef|ifndef|endif|if|else|elif|pragma)\b/g, className: 'text-pink-400' },
    { pattern: /\b(printf|scanf|malloc|free|sizeof|strlen|strcpy|strcmp|memcpy|memset)\b/g, className: 'text-cyan-400' },
  ],
  cpp: [], // Inherits from C
  sql: [
    { pattern: /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|ADD|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CHECK|CONSTRAINT|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|UNION|ALL|EXISTS|LIKE|BETWEEN)\b/gi, className: 'text-purple-400' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /--.*$/gm, className: 'text-gray-500 italic' },
  ],
  html: [
    { pattern: /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g, className: 'text-pink-400' },
    { pattern: /\b([a-zA-Z-]+)=/g, className: 'text-purple-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /(&lt;!--[\s\S]*?--&gt;)/g, className: 'text-gray-500 italic' },
  ],
  css: [
    { pattern: /([.#]?[a-zA-Z_-][a-zA-Z0-9_-]*)\s*\{/g, className: 'text-pink-400' },
    { pattern: /([a-zA-Z-]+)\s*:/g, className: 'text-purple-400' },
    { pattern: /:\s*([^;{}]+)/g, className: 'text-cyan-400' },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500 italic' },
  ],
  bash: [
    { pattern: /\b(if|then|else|elif|fi|for|do|done|while|until|case|esac|in|function|return|local|export|source|echo|exit|cd|pwd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|find|xargs|chmod|chown|sudo|apt|npm|yarn|git|docker)\b/g, className: 'text-purple-400' },
    { pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*/g, className: 'text-cyan-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /#.*$/gm, className: 'text-gray-500 italic' },
  ],
  pseudo: [
    { pattern: /\b(WENN|DANN|SONST|SOLANGE|FÜR|VON|BIS|SCHRITT|WIEDERHOLE|FUNKTION|RÜCKGABE|ENDE|BEGIN|END|IF|THEN|ELSE|WHILE|DO|FOR|TO|STEP|REPEAT|UNTIL|FUNCTION|RETURN|PROCEDURE|CALL|INPUT|OUTPUT|PRINT|READ|ALGORITHM|INTEGER|REAL|BOOLEAN|STRING|ARRAY)\b/gi, className: 'text-purple-400' },
    { pattern: /\b(wahr|falsch|TRUE|FALSE)\b/gi, className: 'text-orange-400' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-400' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /:=/g, className: 'text-pink-400' },
  ],
}

// Inherit patterns
CODE_TOKENS.typescript = CODE_TOKENS.javascript
CODE_TOKENS.cpp = CODE_TOKENS.c
CODE_TOKENS.sh = CODE_TOKENS.bash
CODE_TOKENS.shell = CODE_TOKENS.bash
CODE_TOKENS.js = CODE_TOKENS.javascript
CODE_TOKENS.ts = CODE_TOKENS.typescript
CODE_TOKENS.py = CODE_TOKENS.python

function highlightCodeBlock(code: string, language: string): string {
  const lang = language?.toLowerCase() || 'text'
  const patterns = CODE_TOKENS[lang]
  
  if (!patterns) {
    // No highlighting for unknown languages
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Apply patterns
  for (const { pattern, className } of patterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
    highlighted = highlighted.replace(pattern, (match) => 
      `<span class="${className}">${match}</span>`
    )
  }
  
  return highlighted
}

// Code Block Component mit Copy-Button
function CodeBlock({ 
  code, 
  language 
}: { 
  code: string
  language?: string 
}) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])
  
  const highlightedCode = useMemo(() => 
    highlightCodeBlock(code, language || 'text'),
    [code, language]
  )
  
  return (
    <div className="relative group my-3">
      {/* Language badge & Copy button */}
      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {language && (
          <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded font-mono">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          title="Code kopieren"
        >
          {copied ? (
            <Check size={14} className="text-green-400" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>
      
      {/* Code content */}
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
        <code 
          className="font-mono text-sm text-gray-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  )
}

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
  
  // SCHRITT 0: Konvertiere \( ... \) zu $...$ und \[ ... \] zu $$...$$
  // Dies ist wichtig, da viele LLMs LaTeX mit diesen Delimitern zurückgeben
  // Zuerst display math \[ ... \] -> $$ ... $$
  processed = processed.replace(/\\\[/g, '$$')
  processed = processed.replace(/\\\]/g, '$$')
  // Dann inline math \( ... \) -> $ ... $
  processed = processed.replace(/\\\(/g, '$')
  processed = processed.replace(/\\\)/g, '$')
  
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
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none',
        truncateStyles,
        inline && 'inline',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false }]]}
        components={{
          // Custom code block renderer with syntax highlighting
          code({ node, className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '')
            const language = match ? match[1] : undefined
            const codeString = String(children).replace(/\n$/, '')
            
            // Check if it's a code block (has language) or inline code
            const isCodeBlock = !!language || codeString.includes('\n')
            
            if (isCodeBlock) {
              return <CodeBlock code={codeString} language={language} />
            }
            
            // Inline code
            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            )
          },
          // Ensure pre doesn't wrap our CodeBlock
          pre({ children }) {
            return <>{children}</>
          }
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

export const MarkdownText = MarkdownRenderer

export { normalizeContent as normalizeHandwritingOutput }
