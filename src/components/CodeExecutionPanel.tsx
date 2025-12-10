import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { 
  Play, 
  Pause, 
  ArrowRight,
  ArrowClockwise,
  Terminal,
  Code,
  CheckCircle,
  X,
  FastForward,
  CaretRight
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================================================
// Types
// ============================================================================

export interface CodeLine {
  lineNumber: number
  content: string
  /** Variable state after this line executes */
  variableState?: Record<string, unknown>
  /** Console output from this line */
  consoleOutput?: string
  /** Is this a breakpoint/important line? */
  isBreakpoint?: boolean
  /** Explanation for this line */
  explanation?: string
}

export interface CodeExecutionTask {
  /** Programming language */
  language: 'javascript' | 'typescript' | 'python' | 'java' | 'c' | 'cpp' | 'pseudo'
  /** The code to display/execute */
  code: string
  /** Pre-parsed lines with execution state (optional - will be parsed if not provided) */
  executionSteps?: CodeLine[]
  /** Expected final output */
  expectedOutput?: string
  /** Question about the code */
  question?: string
  /** What the user needs to predict/understand */
  userTask?: 'predict_output' | 'find_bug' | 'trace_variables' | 'explain_logic'
}

interface CodeExecutionPanelProps {
  /** The code execution task */
  codeTask: CodeExecutionTask
  /** Current user answer (for prediction tasks) */
  userAnswer?: string
  /** Callback when execution completes */
  onExecutionComplete?: (success: boolean, output: string) => void
  /** Whether to show the step-by-step execution */
  showExecution?: boolean
  /** Compact mode for smaller displays */
  compact?: boolean
  /** Read-only mode (just display code, no execution) */
  readOnly?: boolean
}

// ============================================================================
// Syntax Highlighting (Simple CSS-based)
// ============================================================================

const TOKEN_PATTERNS: Record<string, { pattern: RegExp; className: string }[]> = {
  javascript: [
    { pattern: /\b(const|let|var|function|return|if|else|for|while|class|new|this|async|await|import|export|from|try|catch|throw)\b/g, className: 'text-purple-500 font-semibold' },
    { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: 'text-orange-500' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-500' },
    { pattern: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-500' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-gray-500 italic' },
    { pattern: /\b(console|Math|Array|Object|String|Number|Boolean|Date|JSON|Promise)\b/g, className: 'text-cyan-500' },
    { pattern: /\.(log|error|warn|info|push|pop|map|filter|reduce|forEach|length|toString)\b/g, className: 'text-blue-400' },
  ],
  typescript: [], // Will inherit from javascript
  python: [
    { pattern: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|with|lambda|yield|raise|pass|break|continue|and|or|not|in|is)\b/g, className: 'text-purple-500 font-semibold' },
    { pattern: /\b(True|False|None)\b/g, className: 'text-orange-500' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-500' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-500' },
    { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, className: 'text-green-500' },
    { pattern: /#.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\b(print|len|range|str|int|float|list|dict|set|tuple|type|input|open)\b/g, className: 'text-cyan-500' },
  ],
  java: [
    { pattern: /\b(public|private|protected|class|interface|extends|implements|static|final|void|return|if|else|for|while|new|this|super|try|catch|throw|throws|import|package)\b/g, className: 'text-purple-500 font-semibold' },
    { pattern: /\b(true|false|null)\b/g, className: 'text-orange-500' },
    { pattern: /\b(\d+\.?\d*[fFdDlL]?)\b/g, className: 'text-amber-500' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-500' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-gray-500 italic' },
    { pattern: /\b(System|String|Integer|Double|Boolean|ArrayList|HashMap|Scanner)\b/g, className: 'text-cyan-500' },
  ],
  c: [
    { pattern: /\b(int|char|float|double|void|return|if|else|for|while|do|switch|case|break|continue|struct|typedef|sizeof|const|static|extern|include|define)\b/g, className: 'text-purple-500 font-semibold' },
    { pattern: /\b(\d+\.?\d*[fFlL]?)\b/g, className: 'text-amber-500' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-500' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-gray-500 italic' },
    { pattern: /#\w+/g, className: 'text-pink-500' },
    { pattern: /\b(printf|scanf|malloc|free|sizeof)\b/g, className: 'text-cyan-500' },
  ],
  cpp: [], // Will inherit from c
  pseudo: [
    { pattern: /\b(WENN|DANN|SONST|SOLANGE|FÜR|VON|BIS|SCHRITT|WIEDERHOLE|FUNKTION|RÜCKGABE|ENDE|BEGIN|END|IF|THEN|ELSE|WHILE|DO|FOR|TO|STEP|REPEAT|UNTIL|FUNCTION|RETURN|PROCEDURE|CALL|INPUT|OUTPUT|PRINT|READ)\b/gi, className: 'text-purple-500 font-semibold' },
    { pattern: /\b(wahr|falsch|TRUE|FALSE)\b/gi, className: 'text-orange-500' },
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-amber-500' },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-500' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 italic' },
    { pattern: /:=/g, className: 'text-pink-500 font-bold' },
  ],
}

// Inherit patterns
TOKEN_PATTERNS.typescript = TOKEN_PATTERNS.javascript
TOKEN_PATTERNS.cpp = TOKEN_PATTERNS.c

function highlightCode(code: string, language: string): string {
  const patterns = TOKEN_PATTERNS[language] || TOKEN_PATTERNS.pseudo
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Apply patterns (simple approach - not perfect but works for most cases)
  for (const { pattern, className } of patterns) {
    highlighted = highlighted.replace(pattern, (match) => 
      `<span class="${className}">${match}</span>`
    )
  }
  
  return highlighted
}

// ============================================================================
// Code Line Component
// ============================================================================

function CodeLineDisplay({
  line,
  isCurrentLine,
  isExecuted,
  showVariables,
  language,
}: {
  line: CodeLine
  isCurrentLine: boolean
  isExecuted: boolean
  showVariables: boolean
  language: string
}) {
  const highlightedContent = highlightCode(line.content, language)
  
  return (
    <motion.div
      layout
      className={cn(
        'flex items-start gap-2 px-3 py-1 font-mono text-sm transition-all duration-300',
        isCurrentLine && 'bg-yellow-500/20 border-l-4 border-yellow-500',
        isExecuted && !isCurrentLine && 'bg-green-500/10',
        !isExecuted && !isCurrentLine && 'opacity-60'
      )}
    >
      {/* Line number */}
      <span className="w-8 text-right text-xs text-muted-foreground select-none shrink-0">
        {line.lineNumber}
      </span>
      
      {/* Execution indicator */}
      <span className="w-4 shrink-0">
        {isCurrentLine && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-block"
          >
            <CaretRight size={14} className="text-yellow-500" weight="bold" />
          </motion.span>
        )}
        {isExecuted && !isCurrentLine && (
          <CheckCircle size={14} className="text-green-500" weight="fill" />
        )}
      </span>
      
      {/* Code content */}
      <div className="flex-1 overflow-x-auto">
        <span 
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
          className="whitespace-pre"
        />
      </div>
      
      {/* Variable state tooltip */}
      {showVariables && isCurrentLine && line.variableState && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-4 px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs"
        >
          {Object.entries(line.variableState).map(([key, value]) => (
            <span key={key} className="mr-2">
              <span className="text-blue-400">{key}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-amber-400">{JSON.stringify(value)}</span>
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

// ============================================================================
// Console Output Component
// ============================================================================

function ConsoleOutput({ 
  outputs, 
  isRunning 
}: { 
  outputs: string[]
  isRunning: boolean 
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [outputs])
  
  return (
    <Card className="bg-gray-950 border-gray-800">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <Terminal size={16} className="text-green-500" />
        <span className="text-xs font-medium text-gray-400">Konsole</span>
        {isRunning && (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="ml-auto text-xs text-yellow-500"
          >
            Läuft...
          </motion.span>
        )}
      </div>
      <div ref={scrollRef} className="p-3 max-h-32 overflow-y-auto font-mono text-sm">
        <AnimatePresence mode="popLayout">
          {outputs.length === 0 ? (
            <span className="text-gray-600 italic">// Warte auf Ausgabe...</span>
          ) : (
            outputs.map((output, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-green-400"
              >
                <span className="text-gray-600 mr-2">&gt;</span>
                {output}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CodeExecutionPanel({
  codeTask,
  userAnswer,
  onExecutionComplete,
  showExecution = true,
  compact = false,
  readOnly = false,
}: CodeExecutionPanelProps) {
  // Parse code into lines if not provided
  const codeLines: CodeLine[] = codeTask.executionSteps || 
    codeTask.code.split('\n').map((content, idx) => ({
      lineNumber: idx + 1,
      content,
    }))
  
  // Execution state
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState(-1)
  const [executedLines, setExecutedLines] = useState<Set<number>>(new Set())
  const [consoleOutputs, setConsoleOutputs] = useState<string[]>([])
  const [executionSpeed, setExecutionSpeed] = useState(2000) // ms per line
  const [showVariables, setShowVariables] = useState(true)
  const [executionComplete, setExecutionComplete] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])
  
  // Execute next line
  const executeNextLine = useCallback(() => {
    setCurrentLineIndex(prev => {
      const next = prev + 1
      if (next >= codeLines.length) {
        // Execution complete
        setIsRunning(false)
        setExecutionComplete(true)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
        onExecutionComplete?.(true, consoleOutputs.join('\n'))
        return prev
      }
      
      const line = codeLines[next]
      
      // Add to executed lines
      setExecutedLines(set => new Set(set).add(next))
      
      // Add console output if any
      if (line.consoleOutput) {
        setConsoleOutputs(outputs => [...outputs, line.consoleOutput!])
      }
      
      return next
    })
  }, [codeLines, consoleOutputs, onExecutionComplete])
  
  // Start execution
  const startExecution = useCallback(() => {
    setIsRunning(true)
    setIsPaused(false)
    setCurrentLineIndex(-1)
    setExecutedLines(new Set())
    setConsoleOutputs([])
    setExecutionComplete(false)
    
    // Execute first line immediately
    setTimeout(executeNextLine, 500)
    
    // Set up interval for subsequent lines
    intervalRef.current = setInterval(() => {
      executeNextLine()
    }, executionSpeed)
  }, [executionSpeed, executeNextLine])
  
  // Pause execution
  const pauseExecution = useCallback(() => {
    setIsPaused(true)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [])
  
  // Resume execution
  const resumeExecution = useCallback(() => {
    setIsPaused(false)
    intervalRef.current = setInterval(() => {
      executeNextLine()
    }, executionSpeed)
  }, [executionSpeed, executeNextLine])
  
  // Step to next line (manual)
  const stepNext = useCallback(() => {
    if (currentLineIndex < codeLines.length - 1) {
      executeNextLine()
    }
  }, [currentLineIndex, codeLines.length, executeNextLine])
  
  // Reset execution
  const resetExecution = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setIsRunning(false)
    setIsPaused(false)
    setCurrentLineIndex(-1)
    setExecutedLines(new Set())
    setConsoleOutputs([])
    setExecutionComplete(false)
  }, [])
  
  // Speed controls
  const speeds = [
    { label: '0.5x', value: 4000 },
    { label: '1x', value: 2000 },
    { label: '2x', value: 1000 },
    { label: '3x', value: 666 },
  ]
  
  return (
    <div className={cn('flex flex-col gap-4', compact && 'gap-2')}>
      {/* Header with language badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code size={20} className="text-primary" />
          <Badge variant="secondary" className="font-mono">
            {codeTask.language.toUpperCase()}
          </Badge>
          {codeTask.userTask && (
            <Badge variant="outline">
              {codeTask.userTask === 'predict_output' && 'Ausgabe vorhersagen'}
              {codeTask.userTask === 'find_bug' && 'Fehler finden'}
              {codeTask.userTask === 'trace_variables' && 'Variablen verfolgen'}
              {codeTask.userTask === 'explain_logic' && 'Logik erklären'}
            </Badge>
          )}
        </div>
        
        {/* Speed selector */}
        {showExecution && !readOnly && (
          <div className="flex items-center gap-1">
            {speeds.map(speed => (
              <Button
                key={speed.value}
                size="sm"
                variant={executionSpeed === speed.value ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => setExecutionSpeed(speed.value)}
              >
                {speed.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      
      {/* Question about the code */}
      {codeTask.question && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <p className="text-sm font-medium">{codeTask.question}</p>
        </Card>
      )}
      
      {/* Code display */}
      <Card className="overflow-hidden bg-gray-950 border-gray-800">
        <ScrollArea className={cn('max-h-80', compact && 'max-h-48')}>
          <div className="py-2">
            {codeLines.map((line, idx) => (
              <CodeLineDisplay
                key={idx}
                line={line}
                isCurrentLine={currentLineIndex === idx}
                isExecuted={executedLines.has(idx)}
                showVariables={showVariables}
                language={codeTask.language}
              />
            ))}
          </div>
        </ScrollArea>
      </Card>
      
      {/* Execution controls */}
      {showExecution && !readOnly && (
        <div className="flex items-center gap-2">
          {!isRunning && !executionComplete && (
            <Button onClick={startExecution} className="gap-2">
              <Play size={16} weight="fill" />
              Programm starten
            </Button>
          )}
          
          {isRunning && !isPaused && (
            <Button onClick={pauseExecution} variant="secondary" className="gap-2">
              <Pause size={16} weight="fill" />
              Pausieren
            </Button>
          )}
          
          {isRunning && isPaused && (
            <>
              <Button onClick={resumeExecution} className="gap-2">
                <Play size={16} weight="fill" />
                Fortsetzen
              </Button>
              <Button onClick={stepNext} variant="outline" className="gap-2">
                <ArrowRight size={16} />
                Nächste Zeile
              </Button>
            </>
          )}
          
          {(isRunning || executionComplete) && (
            <Button onClick={resetExecution} variant="ghost" className="gap-2">
              <ArrowClockwise size={16} />
              Zurücksetzen
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVariables(v => !v)}
            className={cn('ml-auto', showVariables && 'bg-primary/10')}
          >
            Variablen anzeigen
          </Button>
        </div>
      )}
      
      {/* Console output */}
      {showExecution && (
        <ConsoleOutput outputs={consoleOutputs} isRunning={isRunning && !isPaused} />
      )}
      
      {/* Execution complete feedback */}
      <AnimatePresence>
        {executionComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-4 bg-green-500/10 border-green-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle size={24} className="text-green-500" weight="fill" />
                <div>
                  <h4 className="font-semibold text-green-600 dark:text-green-400">
                    Programm beendet
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Das Programm wurde vollständig ausgeführt.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Current line explanation */}
      <AnimatePresence>
        {currentLineIndex >= 0 && codeLines[currentLineIndex]?.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-3 bg-blue-500/10 border-blue-500/30">
              <p className="text-sm">
                <span className="font-medium text-blue-500">Zeile {codeLines[currentLineIndex].lineNumber}:</span>{' '}
                {codeLines[currentLineIndex].explanation}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
