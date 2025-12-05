import { useState } from 'react'
import { Task } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from './MarkdownRenderer'
import { CaretDown, CaretUp, Clock, Tag } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface TaskQuestionPanelProps {
  task: Task
  isFullscreen?: boolean
  defaultExpanded?: boolean
}

export function TaskQuestionPanel({ 
  task, 
  isFullscreen = false,
  defaultExpanded = true 
}: TaskQuestionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const getDifficultyInfo = (difficulty: Task['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return { 
          label: 'Einfach', 
          color: 'bg-green-500/10 text-green-600 border-green-500/20',
          time: '1-2 Min.'
        }
      case 'medium':
        return { 
          label: 'Mittel', 
          color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
          time: '3-5 Min.'
        }
      case 'hard':
        return { 
          label: 'Schwer', 
          color: 'bg-red-500/10 text-red-600 border-red-500/20',
          time: '5-10 Min.'
        }
    }
  }

  const difficultyInfo = getDifficultyInfo(task.difficulty)

  // Format question for better display
  const formatQuestion = (question: string): string => {
    // Add markdown formatting if not already present
    let formatted = question

    // If question starts with a direct statement, make it a heading
    if (!formatted.startsWith('#') && !formatted.startsWith('-') && !formatted.startsWith('*')) {
      const lines = formatted.split('\n')
      if (lines.length > 1) {
        // First line as heading, rest as content
        formatted = `### ${lines[0]}\n\n${lines.slice(1).join('\n')}`
      }
    }

    return formatted
  }

  if (isFullscreen) {
    return (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div 
            className="py-2 sm:py-3 flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Badge variant="outline" className={`${difficultyInfo.color} text-xs shrink-0`}>
                {difficultyInfo.label}
              </Badge>
              <div className="flex items-center gap-1 text-muted-foreground text-xs shrink-0">
                <Clock size={12} />
                <span>{difficultyInfo.time}</span>
              </div>
              {!isExpanded && (
                <span className="text-sm truncate text-muted-foreground">
                  {task.question.substring(0, 60)}...
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
            </Button>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Card className="p-3 sm:p-4 mb-3 bg-card/50">
                  <MarkdownRenderer content={formatQuestion(task.question)} compact />
                  
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
                      <Tag size={12} className="text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  // Default non-fullscreen view
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-medium text-sm sm:text-base">Fragestellung</h3>
        <Badge variant="outline" className={`${difficultyInfo.color} text-xs`}>
          {difficultyInfo.label}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock size={12} />
          <span>{difficultyInfo.time}</span>
        </div>
      </div>
      
      <Card className="p-4 sm:p-5">
        <MarkdownRenderer content={formatQuestion(task.question)} />
        
        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t">
            <Tag size={14} className="text-muted-foreground" />
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
