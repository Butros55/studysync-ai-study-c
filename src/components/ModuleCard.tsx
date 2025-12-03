import { Module } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Folder, FileText, Brain } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface ModuleCardProps {
  module: Module
  onClick: () => void
  scriptCount: number
  taskCount: number
}

export function ModuleCard({ module, onClick, scriptCount, taskCount }: ModuleCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="p-6 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={onClick}
      >
        <div className="flex items-start gap-4">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: module.color }}
          >
            <Folder size={24} weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg tracking-tight mb-1 truncate">
              {module.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">{module.code}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText size={16} />
                <span>{scriptCount} scripts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Brain size={16} />
                <span>{taskCount} tasks</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
