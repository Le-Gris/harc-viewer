import { ref, reactive, computed, onMounted, watch } from 'vue'
import { shuffleArray, sleep, errorMsg, infoMsg, successMsg, parseSizeTuple } from '@/user/utils/uiUtils'
// Grid Class needs to be accessible. Assuming it's either here or imported.
// For simplicity, let's redefine it here or ensure it's imported from uiUtils or its own file.
class Grid {
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

export default function useArcTaskLogic(taskFileName, isTutorialMode, smilestore, viewApi) {
  // --- Task Specific State ---
  const taskName = ref(taskFileName)
  const isTutorial = ref(isTutorialMode)
  const taskData = ref(null) // Raw JSON data for the task {train: [], test: []}
  const arcLogEntries = ref([]) // Log entries for THIS task instance

  const currentInputGrid = ref(new Grid(3, 3))
  const currentOutputGrid = ref(new Grid(3, 3))
  const testPairForTask = ref(null) // The specific test pair (input/output) being worked on

  const currentAttempt = ref(1)
  const MAX_ATTEMPTS = 3
  const isSolved = ref(false)
  let numActionsInTask = 0

  const undoStack = ref([])
  const previousSubmittedOutputGridString = ref('')

  // --- UI Interaction State (scoped to this task) ---
  const selectedTool = ref('edit') // 'edit', 'select', 'floodfill'
  const selectedSymbol = ref(0)
  const outputGridHeight = ref(3)
  const outputGridWidth = ref(3)
  const selectedCells = ref(new Set()) // Set of "x,y" strings for selected cells on output grid
  const copiedCellData = ref({ cells: [], origin: { minX: 0, minY: 0 } })

  // --- Solution Description State (scoped to this task) ---
  const isWritingDescription = ref(false)
  const isFirstDescriptionAttemptForTask = ref(true) // For the two-stage description
  const firstDescriptionText = ref('')
  const finalDescriptionText = ref('') // Final description for this task

  // --- Cosmetic/Config (These could be passed as props or be global) ---
  const EDITION_GRID_CONTAINER_HEIGHT = 400
  const EDITION_GRID_CONTAINER_WIDTH = 400
  const MAX_CELL_SIZE_CONFIG = 100

  // === INITIALIZATION ===
  async function loadTask() {
    numActionsInTask = 0
    arcLogEntries.value = [] // Reset logs for this task
    isSolved.value = false
    currentAttempt.value = 1
    isWritingDescription.value = false
    isFirstDescriptionAttemptForTask.value = true
    firstDescriptionText.value = ''
    finalDescriptionText.value = ''
    undoStack.value = []
    selectedCells.value.clear()
    copiedCellData.value = { cells: [], origin: { minX: 0, minY: 0 } }
    previousSubmittedOutputGridString.value = ''

    const dataPath = isTutorial.value ? 'training' : 'evaluation'
    try {
      // Assuming files are in public/ARC/data/
      const response = await fetch(`/ARC/data/${dataPath}/${taskName.value}`)
      if (!response.ok) throw new Error(`Failed to fetch task ${taskName.value}`)
      taskData.value = await response.json()

      if (!taskData.value || !taskData.value.test || taskData.value.test.length === 0) {
        throw new Error('Task JSON is invalid or has no test pairs.')
      }

      // Use the first test pair as per original logic
      testPairForTask.value = taskData.value.test[0]
      const inputData = testPairForTask.value.input
      currentInputGrid.value = new Grid(inputData.length, inputData[0].length, inputData)

      resetOutputGrid() // Initialize output grid to default 3x3
      _logActionInternal('load_task_success', { name: taskName.value })
    } catch (error) {
      errorMsg(`Error loading task ${taskName.value}: ${error.message}`)
      console.error(error)
      // Handle error: maybe call viewApi.goNextView() to skip problematic task or show error state
      // For now, it will just show an empty grid.
      _logActionInternal('load_task_failed', { name: taskName.value, error: error.message })
    }
  }

  // === ACTION LOGGING (Specific to this task) ===
  function _logActionInternal(action, details = {}) {
    numActionsInTask++
    const logEntry = {
      action,
      task_name: taskName.value,
      is_tutorial: isTutorial.value,
      attempt_for_task: currentAttempt.value,
      action_number_in_task: numActionsInTask,
      task_is_solved: isSolved.value,
      timestamp: new Date().toISOString(),
      current_output_grid_snapshot: _gridToString(currentOutputGrid.value),
      // ... other relevant details from original logging (tool, symbol, etc.)
      ...details,
    }
    arcLogEntries.value.push(logEntry)
  }

  function _saveTaskDataToSmileStore() {
    if (taskName.value) {
      if (!smilestore.data.arc) smilestore.data.arc = {}
      // Store all logs for this specific task under its name
      // This will overwrite if the same task is somehow run multiple times in a session without different identifiers
      smilestore.data.arc[taskName.value] = {
        isSolved: isSolved.value,
        attempts: currentAttempt.value,
        firstDescription: firstDescriptionText.value,
        finalDescription: finalDescriptionText.value,
        actionLogs: JSON.parse(JSON.stringify(arcLogEntries.value)), // Deep copy
      }
      smilestore.saveData()
    }
  }

  // === GRID UTILITIES ===
  function _gridToString(gridInstance) {
    if (!gridInstance || !gridInstance.grid) return ''
    return gridInstance.grid.map((row) => row.join('')).join('|')
  }

  function _pushToUndoStack() {
    undoStack.value.push(JSON.parse(JSON.stringify(currentOutputGrid.value.grid)))
    if (undoStack.value.length > 20) undoStack.value.shift()
  }

  // === GRID MANIPULATION METHODS (similar to useArcExperiment, but scoped) ===
  function updateOutputGridSize(height, width) {
    if (height === outputGridHeight.value && width === outputGridWidth.value) return
    _pushToUndoStack()
    currentOutputGrid.value = new Grid(height, width, currentOutputGrid.value.grid)
    outputGridHeight.value = height
    outputGridWidth.value = width
    selectedCells.value.clear()
    _logActionInternal('resize_output_grid', { newHeight: height, newWidth: width })
  }

  function resetOutputGrid() {
    _pushToUndoStack()
    currentOutputGrid.value = new Grid(3, 3)
    outputGridHeight.value = 3
    outputGridWidth.value = 3
    selectedCells.value.clear()
    selectedSymbol.value = 0
    selectedTool.value = 'edit'
    _logActionInternal('reset_output_grid')
  }

  function copyInputToOutput() {
    if (!currentInputGrid.value) return
    _pushToUndoStack()
    currentOutputGrid.value = new Grid(
      currentInputGrid.value.height,
      currentInputGrid.value.width,
      JSON.parse(JSON.stringify(currentInputGrid.value.grid)) // Deep copy
    )
    outputGridHeight.value = currentInputGrid.value.height
    outputGridWidth.value = currentInputGrid.value.width
    selectedCells.value.clear()
    _logActionInternal('copy_input_to_output')
  }

  function undoLastAction() {
    if (undoStack.value.length > 0) {
      const prevState = undoStack.value.pop()
      currentOutputGrid.value = new Grid(prevState.length, prevState[0].length, prevState)
      outputGridHeight.value = prevState.length
      outputGridWidth.value = prevState[0].length
      selectedCells.value.clear()
      _logActionInternal('undo')
    } else {
      infoMsg('No more actions to undo for this task.')
    }
  }

  function _floodfill(gridData, x, y, newSymbol) {
    // Expects gridData = gridInstance.grid
    const rows = gridData.length
    const cols = gridData[0].length
    const targetSymbol = gridData[x][y]
    if (targetSymbol === newSymbol) return false // No change

    const q = [[x, y]]
    gridData[x][y] = newSymbol // Mark visited and change
    let head = 0
    while (head < q.length) {
      const [cx, cy] = q[head++]
      ;[
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].forEach(([dx, dy]) => {
        const nx = cx + dx
        const ny = cy + dy
        if (nx >= 0 && nx < rows && ny >= 0 && ny < cols && gridData[nx][ny] === targetSymbol) {
          gridData[nx][ny] = newSymbol
          q.push([nx, ny])
        }
      })
    }
    return true // Changed
  }

  function handleCellInteraction(payload) {
    // { type: 'click'/'mousedown'/'mousemove'/'mouseup', x, y, event }
    const { type, x, y, event } = payload
    let actionPerformed = false

    if (type === 'click' && selectedTool.value !== 'select') {
      if (selectedTool.value === 'edit') {
        if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
          _pushToUndoStack()
          currentOutputGrid.value.grid[x][y] = selectedSymbol.value
          actionPerformed = true
          _logActionInternal('draw_cell_click', { x, y, symbol: selectedSymbol.value })
        }
      } else if (selectedTool.value === 'floodfill') {
        _pushToUndoStack() // Push before attempting fill
        if (_floodfill(currentOutputGrid.value.grid, x, y, selectedSymbol.value)) {
          actionPerformed = true
          _logActionInternal('floodfill_cell', { x, y, symbol: selectedSymbol.value })
        } else {
          undoStack.value.pop() // No change, remove undo state
        }
      }
    } else if (type === 'mousedown' && selectedTool.value === 'edit' && event.buttons === 1) {
      // Start of a drag-draw
      if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
        _pushToUndoStack() // Push for the start of this continuous action
        currentOutputGrid.value.grid[x][y] = selectedSymbol.value
        actionPerformed = true
        // Log drag start or defer to mouseup
      }
    } else if (type === 'mousemove' && selectedTool.value === 'edit' && event.buttons === 1) {
      // During a drag-draw
      if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
        // No separate undo push for each mousemove; part of the mousedown's undo
        currentOutputGrid.value.grid[x][y] = selectedSymbol.value
        actionPerformed = true
      }
    } else if (type === 'mouseup' && selectedTool.value === 'edit') {
      // End of a drag-draw
      // Consider logging the entire drag operation here if not logged per mousemove
      _logActionInternal('draw_cell_drag_end', { final_x: x, final_y: y, symbol: selectedSymbol.value })
    }
    // Select tool interactions are handled by `updateSelectedCells` and subsequent actions
  }

  function updateSelectedCellsOnOutputGrid(newSelection) {
    selectedCells.value = newSelection
    _logActionInternal('output_grid_selection_updated', { count: newSelection.size })
  }

  function changeColorOfSelectedOutputCells() {
    if (selectedCells.value.size > 0 && selectedTool.value === 'select') {
      _pushToUndoStack()
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
        _logActionInternal('change_color_selected_cells', {
          symbol: selectedSymbol.value,
          count: selectedCells.value.size,
        })
      } else {
        undoStack.value.pop() // No change, remove undo
      }
      // selectedCells.value.clear(); // Optional: clear selection after action
    }
  }

  function copyFromSelectedOutputCells() {
    if (selectedCells.value.size === 0 || selectedTool.value !== 'select') {
      infoMsg('Select cells on the output grid with the Select tool first, then press Copy.')
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
    _logActionInternal('copy_output_cells_to_clipboard', { count: cellsToCopy.length })
    successMsg(`${cellsToCopy.length} cells copied! Select a single target cell on output grid and press Paste.`)
  }

  function pasteToOutputCells() {
    if (copiedCellData.value.cells.length === 0) {
      errorMsg('Clipboard is empty. Copy some cells first.')
      return
    }
    if (selectedCells.value.size !== 1 || selectedTool.value !== 'select') {
      errorMsg('Select a single target cell on the output grid with the Select tool to paste.')
      return
    }
    _pushToUndoStack()
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
      _logActionInternal('paste_cells_to_output_grid', { targetX, targetY, count: cells.length })
      successMsg('Pasted cells.')
    } else {
      undoStack.value.pop() // No change, remove undo
      infoMsg('Paste resulted in no changes to the grid.')
    }
    // selectedCells.value.clear();
  }

  // === SOLUTION SUBMISSION & DESCRIPTION (for this task) ===
  function _verifyCurrentSolution() {
    if (!testPairForTask.value || !testPairForTask.value.output) return false
    const referenceOutput = testPairForTask.value.output
    const submittedGrid = currentOutputGrid.value

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

  function handleSubmitAttempt() {
    const currentGridStr = _gridToString(currentOutputGrid.value)
    if (currentAttempt.value > 1 && currentGridStr === previousSubmittedOutputGridString.value) {
      errorMsg('You have already submitted this exact solution for this attempt. Please try something different.')
      return
    }
    previousSubmittedOutputGridString.value = currentGridStr

    if (isFirstDescriptionAttemptForTask.value && !isTutorial.value) {
      // Tutorial might have different description flow
      isWritingDescription.value = true
      _logActionInternal('prompt_first_description')
      infoMsg('Please describe your approach before we check your solution.')
      return // Wait for first description
    }
    _checkAndProcessSubmittedSolution()
  }

  function submitTaskDescription(descriptionText) {
    if (!descriptionText.trim()) {
      errorMsg('Description cannot be empty.')
      return
    }
    if (isFirstDescriptionAttemptForTask.value && !isTutorial.value) {
      firstDescriptionText.value = descriptionText
      _logActionInternal('submit_first_description', { description: descriptionText })
      isFirstDescriptionAttemptForTask.value = false
      isWritingDescription.value = false
      _checkAndProcessSubmittedSolution() // Now check the pending solution
    } else {
      // This is the final description (after solving, or exhausting attempts, or for tutorial)
      finalDescriptionText.value = descriptionText
      _logActionInternal('submit_final_description', { description: descriptionText })
      isWritingDescription.value = false
      _finishTask() // Proceed to next step in timeline
    }
  }

  function _checkAndProcessSubmittedSolution() {
    isSolved.value = _verifyCurrentSolution()
    _logActionInternal('submit_solution_check', {
      attemptNumber: currentAttempt.value,
      isCorrect: isSolved.value,
    })

    if (isSolved.value) {
      successMsg('Correct! Your solution matches.')
      isWritingDescription.value = true // Prompt for final description
      infoMsg(
        isTutorial.value
          ? 'Tutorial solved! Please provide the final description.'
          : 'Task solved! Please describe your solution.'
      )
      // Waits for submitTaskDescription for the finalDescriptionText
    } else {
      currentAttempt.value++
      if (currentAttempt.value > MAX_ATTEMPTS) {
        errorMsg(`Incorrect. You have used all ${MAX_ATTEMPTS} attempts for this task.`)
        isWritingDescription.value = true // Prompt for final description (what they thought)
        infoMsg('Please describe what you thought the solution was.')
      } else {
        errorMsg(`Incorrect. Please try again. Attempt ${currentAttempt.value} of ${MAX_ATTEMPTS}.`)
        // Stay on current task, allow more attempts. isWritingDescription remains false.
      }
    }
  }

  function _finishTask() {
    _saveTaskDataToSmileStore()
    // Tell the parent (ArcTaskRunnerView) that this task is done, so it can call api.next()
    // This can be done via an emitted event or a callback.
    // For now, let's assume ArcTaskRunnerView will watch 'isSolved' or a specific "isTaskFinished" flag.
    // Or, viewApi.next() can be called directly if appropriate.
    // Let the view handle calling viewApi.next()
    if (parentFinishCallback) parentFinishCallback()
  }

  let parentFinishCallback = null
  function onFinish(cb) {
    parentFinishCallback = cb
  }

  // --- Auto Solve (for debugging/testing) ---
  function autoSolve() {
    if (testPairForTask.value && testPairForTask.value.output) {
      const refOutput = testPairForTask.value.output
      _pushToUndoStack()
      currentOutputGrid.value = new Grid(refOutput.length, refOutput[0].length, refOutput)
      outputGridHeight.value = refOutput.length
      outputGridWidth.value = refOutput[0].length
      _logActionInternal('auto_solve_task')
      successMsg('Task auto-solved (for testing).')
    } else {
      errorMsg('No reference solution available to auto-solve.')
    }
  }

  // Expose reactive state and methods
  return {
    // Task Info
    taskName,
    isTutorial,
    taskData, // For displaying examples (train pairs)
    currentInputGrid,
    currentOutputGrid,
    currentAttempt,
    MAX_ATTEMPTS,
    isSolved,

    // UI State
    selectedTool,
    selectedSymbol,
    outputGridHeight,
    outputGridWidth,
    selectedCells, // For EditableGrid's :selectedCells prop
    isWritingDescription,
    isFirstDescriptionAttemptForTask,
    firstDescriptionText, // for v-model
    finalDescriptionText, // for v-model

    // Grid Config (passed to EditableGrid)
    EDITION_GRID_CONTAINER_HEIGHT,
    EDITION_GRID_CONTAINER_WIDTH,
    MAX_CELL_SIZE_CONFIG,

    // Methods
    loadTask, // Call on component mount
    updateOutputGridSize,
    resetOutputGrid,
    copyInputToOutput,
    undoLastAction,
    handleCellInteraction, // For output grid
    updateSelectedCellsOnOutputGrid, // For output grid selection
    changeColorOfSelectedOutputCells,
    copyFromSelectedOutputCells,
    pasteToOutputCells,
    handleSubmitAttempt,
    submitTaskDescription,
    autoSolve, // For testing
    onFinish, // Callback to signal task completion to the view
    _gridToString, // Expose for debugging or other purposes
  }
}
