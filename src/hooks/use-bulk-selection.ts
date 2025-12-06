import { useState, useCallback, useEffect } from 'react'

interface UseBulkSelectionOptions<T> {
  items: T[]
  getId: (item: T) => string
}

/**
 * A reusable hook for managing bulk selection of items
 */
export function useBulkSelection<T>({ items, getId }: UseBulkSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Clean up selected IDs when items change
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set<string>()
      items.forEach((item) => {
        const id = getId(item)
        if (prev.has(id)) validIds.add(id)
      })
      return validIds
    })
  }, [items, getId])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = prev.size === items.length && items.length > 0
      return allSelected ? new Set() : new Set(items.map(getId))
    })
  }, [items, getId])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)))
  }, [items, getId])

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  const hasSelection = selectedIds.size > 0
  const allSelected = items.length > 0 && selectedIds.size === items.length
  const selectedItems = items.filter((item) => selectedIds.has(getId(item)))

  return {
    selectedIds,
    selectedItems,
    hasSelection,
    allSelected,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    selectAll,
    isSelected,
  }
}
