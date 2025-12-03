export const MODULE_COLORS = [
  'oklch(0.45 0.15 250)',
  'oklch(0.50 0.18 280)',
  'oklch(0.48 0.16 200)',
  'oklch(0.52 0.15 170)',
  'oklch(0.47 0.17 220)',
  'oklch(0.51 0.14 260)',
]

export const getRandomColor = () => {
  return MODULE_COLORS[Math.floor(Math.random() * MODULE_COLORS.length)]
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
