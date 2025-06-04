// Grid Class and ARC Task Utilities
import { errorMsg } from './uiUtils'

export class Grid {
  constructor(height, width, values) {
    this.height = height
    this.width = width
    this.grid = Array(height)
      .fill(null)
      .map((_, i) =>
        Array(width)
          .fill(null)
          .map((_, j) => {
            if (values && values[i] && values[i][j] !== undefined) {
              return values[i][j]
            }
            return 0 // Default symbol
          })
      )
  }
}

export function gridToString(gridInstance) {
  if (!gridInstance || !gridInstance.grid) return ''
  return gridInstance.grid.map((row) => row.join('')).join('|')
}

export async function fetchTaskData(fileName, type = 'evaluation', viewApi = null) {
  try {
    const basePath = viewApi ? viewApi.getPublicUrl(`ARC/data/${type}/${fileName}`) : `/ARC/data/${type}/${fileName}`
    const response = await fetch(basePath)
    if (!response.ok) throw new Error(`Failed to fetch task ${fileName}`)
    return await response.json()
  } catch (error) {
    errorMsg(`Error loading task ${fileName}: ${error.message}`)
    console.error(error)
    return null
  }
}

export function floodfill(gridData, x, y, newSymbol) {
  const rows = gridData.length
  const cols = gridData[0].length
  const targetSymbol = gridData[x][y]

  if (targetSymbol === newSymbol) return false // No change needed

  const queue = [[x, y]]
  gridData[x][y] = newSymbol
  let head = 0

  while (head < queue.length) {
    const [cx, cy] = queue[head++]
    const directions = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]

    directions.forEach(([dx, dy]) => {
      const nx = cx + dx
      const ny = cy + dy
      if (nx >= 0 && nx < rows && ny >= 0 && ny < cols && gridData[nx][ny] === targetSymbol) {
        gridData[nx][ny] = newSymbol
        queue.push([nx, ny])
      }
    })
  }

  return true // Changed
}

export function verifySolution(referenceOutput, submittedGrid) {
  if (!referenceOutput || !submittedGrid) return false

  if (referenceOutput.length !== submittedGrid.height || referenceOutput[0].length !== submittedGrid.width) {
    return false
  }

  for (let i = 0; i < referenceOutput.length; i++) {
    for (let j = 0; j < referenceOutput[i].length; j++) {
      if (referenceOutput[i][j] !== submittedGrid.grid[i][j]) {
        return false
      }
    }
  }

  return true
}

export function createLogEntry(action, details = {}) {
  return {
    action,
    timestamp: new Date().toISOString(),
    ...details,
  }
}
