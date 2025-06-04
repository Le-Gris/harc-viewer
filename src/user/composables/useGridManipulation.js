import { ref } from 'vue'
import { Grid, floodfill } from '@/user/utils/arcUtils'
import { GRID_CONFIG, TOOLS, DEFAULT_SYMBOL, EXPERIMENT_CONFIG } from '@/user/utils/arcConstants'
import { infoMsg, successMsg, errorMsg } from '@/user/utils/uiUtils'

export default function useGridManipulation(logAction) {
  // Grid state
  const currentOutputGrid = ref(new Grid(GRID_CONFIG.DEFAULT_HEIGHT, GRID_CONFIG.DEFAULT_WIDTH))
  const outputGridHeight = ref(GRID_CONFIG.DEFAULT_HEIGHT)
  const outputGridWidth = ref(GRID_CONFIG.DEFAULT_WIDTH)
  const undoStack = ref([])

  // UI state
  const selectedTool = ref(TOOLS.EDIT)
  const selectedSymbol = ref(DEFAULT_SYMBOL)
  const selectedCells = ref(new Set())
  const copiedCellData = ref({ cells: [], origin: { minX: 0, minY: 0 } })

  function pushToUndoStack() {
    undoStack.value.push(JSON.parse(JSON.stringify(currentOutputGrid.value.grid)))
    if (undoStack.value.length > EXPERIMENT_CONFIG.UNDO_STACK_LIMIT) {
      undoStack.value.shift()
    }
  }

  function updateOutputGridSize(height, width) {
    if (height === outputGridHeight.value && width === outputGridWidth.value) return

    pushToUndoStack()
    currentOutputGrid.value = new Grid(height, width, currentOutputGrid.value.grid)
    outputGridHeight.value = height
    outputGridWidth.value = width
    selectedCells.value.clear()
    logAction('resize_output_grid', { newHeight: height, newWidth: width })
  }

  function resetOutputGrid() {
    pushToUndoStack()
    currentOutputGrid.value = new Grid(GRID_CONFIG.DEFAULT_HEIGHT, GRID_CONFIG.DEFAULT_WIDTH)
    outputGridHeight.value = GRID_CONFIG.DEFAULT_HEIGHT
    outputGridWidth.value = GRID_CONFIG.DEFAULT_WIDTH
    selectedCells.value.clear()
    selectedSymbol.value = DEFAULT_SYMBOL
    selectedTool.value = TOOLS.EDIT
    logAction('reset_output_grid')
  }

  function copyInputToOutput(inputGrid) {
    if (!inputGrid) return

    pushToUndoStack()
    currentOutputGrid.value = new Grid(inputGrid.height, inputGrid.width, JSON.parse(JSON.stringify(inputGrid.grid)))
    outputGridHeight.value = inputGrid.height
    outputGridWidth.value = inputGrid.width
    selectedCells.value.clear()
    logAction('copy_input_to_output')
  }

  function undoLastAction() {
    if (undoStack.value.length > 0) {
      const prevState = undoStack.value.pop()
      currentOutputGrid.value = new Grid(prevState.length, prevState[0].length, prevState)
      outputGridHeight.value = prevState.length
      outputGridWidth.value = prevState[0].length
      selectedCells.value.clear()
      logAction('undo')
    } else {
      infoMsg('No more actions to undo.')
    }
  }

  function handleCellInteraction(payload) {
    const { type, x, y, event } = payload

    if (type === 'click' && selectedTool.value !== TOOLS.SELECT) {
      if (selectedTool.value === TOOLS.EDIT) {
        if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
          pushToUndoStack()
          currentOutputGrid.value.grid[x][y] = selectedSymbol.value
          logAction('draw_cell_click', { x, y, symbol: selectedSymbol.value })
        }
      } else if (selectedTool.value === TOOLS.FLOODFILL) {
        pushToUndoStack()
        if (floodfill(currentOutputGrid.value.grid, x, y, selectedSymbol.value)) {
          logAction('floodfill_cell', { x, y, symbol: selectedSymbol.value })
        } else {
          undoStack.value.pop() // No change, remove undo state
        }
      }
    } else if (type === 'mousedown' && selectedTool.value === TOOLS.EDIT && event.buttons === 1) {
      if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
        pushToUndoStack()
        currentOutputGrid.value.grid[x][y] = selectedSymbol.value
      }
    } else if (type === 'mousemove' && selectedTool.value === TOOLS.EDIT && event.buttons === 1) {
      if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
        currentOutputGrid.value.grid[x][y] = selectedSymbol.value
      }
    } else if (type === 'mouseup' && selectedTool.value === TOOLS.EDIT) {
      logAction('draw_cell_drag_end', { final_x: x, final_y: y, symbol: selectedSymbol.value })
    }
  }

  function updateSelectedCells(newSelection) {
    selectedCells.value = newSelection
    logAction('selection_updated', { count: newSelection.size })
  }

  function changeColorOfSelectedCells() {
    if (selectedCells.value.size > 0 && selectedTool.value === TOOLS.SELECT) {
      pushToUndoStack()
      let changed = false
      selectedCells.value.forEach((coordStr) => {
        const [x, y] = coordStr.split(',').map(Number)
        if (
          currentOutputGrid.value.grid[x]?.[y] !== undefined &&
          currentOutputGrid.value.grid[x][y] !== selectedSymbol.value
        ) {
          currentOutputGrid.value.grid[x][y] = selectedSymbol.value
          changed = true
        }
      })
      if (changed) {
        logAction('change_color_selected_cells', { symbol: selectedSymbol.value, count: selectedCells.value.size })
      } else {
        undoStack.value.pop()
      }
    }
  }

  function copySelectedCells() {
    if (selectedCells.value.size === 0 || selectedTool.value !== TOOLS.SELECT) {
      infoMsg('Select cells with the Select tool first, then press Copy.')
      return
    }

    const cellsToCopy = []
    let minX = Infinity,
      minY = Infinity
    selectedCells.value.forEach((coordStr) => {
      const [x, y] = coordStr.split(',').map(Number)
      cellsToCopy.push({ x, y, symbol: currentOutputGrid.value.grid[x][y] })
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
    })

    copiedCellData.value = { cells: cellsToCopy, origin: { minX, minY } }
    logAction('copy_cells_to_clipboard', { count: cellsToCopy.length })
    successMsg(`${cellsToCopy.length} cells copied! Select a single target cell and press Paste.`)
  }

  function pasteCopiedCells() {
    if (copiedCellData.value.cells.length === 0) {
      errorMsg('Clipboard is empty. Copy some cells first.')
      return
    }
    if (selectedCells.value.size !== 1 || selectedTool.value !== TOOLS.SELECT) {
      errorMsg('Select a single target cell with the Select tool to paste.')
      return
    }

    pushToUndoStack()
    const targetCoordStr = selectedCells.value.values().next().value
    const [targetX, targetY] = targetCoordStr.split(',').map(Number)
    const { cells, origin } = copiedCellData.value
    let pasted = false

    cells.forEach((cell) => {
      const newX = targetX + (cell.x - origin.minX)
      const newY = targetY + (cell.y - origin.minY)
      if (newX >= 0 && newX < currentOutputGrid.value.height && newY >= 0 && newY < currentOutputGrid.value.width) {
        if (currentOutputGrid.value.grid[newX][newY] !== cell.symbol) {
          currentOutputGrid.value.grid[newX][newY] = cell.symbol
          pasted = true
        }
      }
    })

    if (pasted) {
      logAction('paste_cells_from_clipboard', { targetX, targetY, count: cells.length })
      successMsg('Pasted cells.')
    } else {
      undoStack.value.pop()
      infoMsg('Paste resulted in no changes.')
    }
    selectedCells.value.clear()
  }

  function autoSolve(referenceOutput) {
    if (referenceOutput) {
      pushToUndoStack()
      currentOutputGrid.value = new Grid(referenceOutput.length, referenceOutput[0].length, referenceOutput)
      outputGridHeight.value = referenceOutput.length
      outputGridWidth.value = referenceOutput[0].length
      logAction('auto_solve_task')
      successMsg('Task auto-solved (for testing).')
    } else {
      errorMsg('No reference solution available to auto-solve.')
    }
  }

  return {
    // State
    currentOutputGrid,
    outputGridHeight,
    outputGridWidth,
    selectedTool,
    selectedSymbol,
    selectedCells,
    undoStack,

    // Methods
    updateOutputGridSize,
    resetOutputGrid,
    copyInputToOutput,
    undoLastAction,
    handleCellInteraction,
    updateSelectedCells,
    changeColorOfSelectedCells,
    copySelectedCells,
    pasteCopiedCells,
    autoSolve,
    pushToUndoStack,
  }
}
