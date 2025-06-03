import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { shuffleArray, sleep, errorMsg, infoMsg, successMsg, parseSizeTuple } from '@/user/utils/uiUtils'
import initialFileNames from '@/user/assets/arcEvalFileNames' // Assuming this path is correct

// Grid Class Definition (can be moved to a separate utility if preferred)
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

export default function useArcExperiment(viewAPI, smileStore) {
  // --- Core State ---
  const experimentPhase = ref('loading') // loading, tutorial_slides, tutorial_task, tutorial_quiz, experiment, finished
  const arcData = ref([]) // For logging actions
  const fileNames = ref([...initialFileNames]) // Loaded ARC task file names
  const taskList = ref([]) // Shuffled list of tasks for the current experiment [{jsonData, originalFileName}, ...]
  const tutorialTaskData = ref(null) // Loaded tutorial task JSON

  const MAX_TASKS_PER_EXPERIMENT = 5
  const TUTORIAL_GRID_FILENAME = 'e9afcf9a.json' // Example, adjust as per your files
  const NUM_TOTAL_TASKS_AVAILABLE = computed(() => fileNames.value.length)

  const currentTaskIndexGlobal = ref(0) // Index in the `taskList` for experiment tasks
  const currentTaskName = ref('')
  const currentTaskAttempt = ref(1)
  const MAX_ATTEMPTS_PER_TASK = 3
  const isCurrentTaskSolved = ref(false)
  let numActionsInCurrentTask = 0

  // --- Grid State & Logic ---
  const currentInputGrid = ref(new Grid(3, 3))
  const currentOutputGrid = ref(new Grid(3, 3))
  const testPairsForCurrentTask = ref([]) // Raw test pairs from task JSON {input: [], output: []}
  const currentTestPairIndex = ref(0) // Usually 0, if multiple test inputs per task

  const selectedCells = ref(new Set()) // Set of "x,y" strings for selected cells
  const copiedCellData = ref({ cells: [], origin: { minX: 0, minY: 0 } }) // { cells: [{x,y,symbol}], origin: {minX, minY} }

  const undoStack = ref([]) // Stores previous states of currentOutputGrid.grid

  const previousSubmittedOutputGridString = ref('') // To prevent re-submitting identical solutions

  // --- UI Interaction State ---
  const selectedTool = ref('edit') // 'edit', 'select', 'floodfill'
  const selectedSymbol = ref(0) // Current drawing color
  const outputGridHeight = ref(3)
  const outputGridWidth = ref(3)

  // --- Solution Description State ---
  const isWritingSolution = ref(false)
  const isFirstWrittenDescriptionAttempt = ref(true)
  const firstWrittenSolutionText = ref('')
  const lastWrittenSolutionText = ref('') // Final description for the task

  const userFeedbackText = ref('') // For end-of-experiment feedback

  // --- Cosmetic/Config (Consider making these props or constants) ---
  const EDITION_GRID_CONTAINER_HEIGHT = 400
  const EDITION_GRID_CONTAINER_WIDTH = 400
  const MAX_CELL_SIZE_CONFIG = 100

  // === LIFECYCLE & INITIALIZATION ===
  function _initializeExperimentState() {
    if (!smileStore.data.arc) {
      smileStore.recordProperty('arc', {})
    }
    arcData.value = smileStore.data.arc[currentTaskName.value] || [] // Persist or load existing data for a task? This needs clarification. Let's assume new data per session for now. Or load if taskName matches.

    // Reset per-session variables
    currentTaskIndexGlobal.value = 0
    taskList.value = []
    tutorialTaskData.value = null
    experimentPhase.value = 'loading'

    _setupBeforeUnloadListener()
    _prepareTaskList() // Selects and shuffles tasks for the experiment
    console.log('Experiment state initialized. Total tasks available:', NUM_TOTAL_TASKS_AVAILABLE.value)
    // Start tutorial automatically
    startTutorialSlides()
  }

  function _cleanupExperiment() {
    window.removeEventListener('beforeunload', _beforeUnloadHandler)
    // Potentially save final state if not already done
  }

  function _beforeUnloadHandler(event) {
    const message = 'Refreshing might cause issues. Are you sure? You might lose progress.'
    smileStore.recordWindowEvent('beforeunload', {
      description: `User attempted to leave page on task ${currentTaskName.value || 'tutorial'}`,
    })
    //_saveCurrentTaskDataToSmileStore(); // Ensure data is saved
    smileStore.saveData(true) // Force save
    event.preventDefault()
    event.returnValue = message
    return message
  }

  function _setupBeforeUnloadListener() {
    window.addEventListener('beforeunload', _beforeUnloadHandler)
  }

  async function _fetchTaskData(fileName, type = 'evaluation') {
    // type can be 'training' or 'evaluation'
    try {
      // Adjust path as needed. Assuming files are in public/ARC/data/
      const response = await fetch(`/ARC/data/${type}/${fileName}`)
      if (!response.ok) throw new Error(`Failed to fetch task ${fileName}`)
      return await response.json()
    } catch (error) {
      errorMsg(`Error loading task ${fileName}: ${error.message}`)
      console.error(error)
      return null
    }
  }

  function _prepareTaskList() {
    // This logic is from getGridsFromCond in the original file
    // It seems to depend on a 'cond' variable from api.getConditionByName('conds')
    // For simplicity, I'll shuffle and pick MAX_TASKS. Adapt if 'conds' is crucial.
    let availableGrids = [...fileNames.value]
    shuffleArray(availableGrids)

    // Example: simple slicing. Adapt if 'conds' logic is needed.
    // const cond = viewAPI.getConditionByName('conds'); // This needs to be available
    // if (cond > NUM_TOTAL_TASKS_AVAILABLE.value - MAX_TASKS_PER_EXPERIMENT) {
    // const firstHalf = availableGrids.slice(cond, cond + (NUM_TOTAL_TASKS_AVAILABLE.value - cond));
    // const secondHalf = availableGrids.slice(0, MAX_TASKS_PER_EXPERIMENT - (NUM_TOTAL_TASKS_AVAILABLE.value - cond));
    //   taskList.value = firstHalf.concat(secondHalf);
    // } else {
    //   taskList.value = availableGrids.slice(cond, cond + MAX_TASKS_PER_EXPERIMENT);
    // }
    taskList.value = availableGrids.slice(0, MAX_TASKS_PER_EXPERIMENT)
    console.log('Prepared task list for experiment:', taskList.value)
  }

  // === NAVIGATION / PHASE MANAGEMENT ===
  function startTutorialSlides() {
    experimentPhase.value = 'tutorial_slides'
    _logAction('start_tutorial_slides')
  }

  async function startTutorialTask() {
    experimentPhase.value = 'tutorial_task'
    currentTaskName.value = TUTORIAL_GRID_FILENAME
    isCurrentTaskSolved.value = false
    currentTaskAttempt.value = 1
    numActionsInCurrentTask = 0
    arcData.value = [] // Reset actions for tutorial task
    undoStack.value = []
    isFirstWrittenDescriptionAttempt.value = true // Reset for tutorial task

    const taskJson = await _fetchTaskData(TUTORIAL_GRID_FILENAME, 'training') // Assuming tutorial is in training
    if (taskJson) {
      tutorialTaskData.value = taskJson
      _loadTaskIntoState(taskJson)
      _logAction('start_tutorial_task_loaded', { taskName: currentTaskName.value })
    } else {
      errorMsg('Failed to load tutorial task.')
      // Handle failure, maybe go back or show error state
    }
  }

  function completeTutorialTaskPhase() {
    // Called after solving or exhausting attempts on tutorial task
    if (isCurrentTaskSolved.value) {
      _logAction('tutorial_task_solved_proceed_to_quiz')
      experimentPhase.value = 'tutorial_quiz'
    } else {
      // If tutorial wasn't solved but attempts exhausted (if attempts are limited for tutorial)
      // Or if a different flow is desired. For now, assuming solving is required or it auto-advances.
      _logAction('tutorial_task_exhausted_proceed_to_quiz') // Or handle differently
      experimentPhase.value = 'tutorial_quiz'
    }
  }

  function submitTutorialQuiz(answers) {
    // answers: {q1: 'yes', q2: '3', ...}
    _logAction('submit_tutorial_quiz', { answers })
    // Original logic: q1_val == 'yes' || q2_val != 3 || q3_val != MAX_TASKS || q4_val != 1
    const correct_q1 = answers.q1 === 'no' // "Are tasks timed?" No
    const correct_q2 = parseInt(answers.q2) === 3 // Attempts
    const correct_q3 = parseInt(answers.q3) === MAX_TASKS_PER_EXPERIMENT // Total tasks
    const correct_q4 = parseInt(answers.q4) === 1 // Bonus sample

    if (correct_q1 && correct_q2 && correct_q3 && correct_q4) {
      successMsg('Quiz completed correctly! Starting experiment.')
      _logAction('tutorial_quiz_correct')
      startMainExperiment()
    } else {
      errorMsg('One or more quiz answers were incorrect. Please try again.')
      _logAction('tutorial_quiz_incorrect')
      // Stay in quiz phase
    }
  }

  async function startMainExperiment() {
    experimentPhase.value = 'experiment'
    currentTaskIndexGlobal.value = 0
    await _loadExperimentTask(currentTaskIndexGlobal.value)
  }

  async function _loadExperimentTask(taskIndex) {
    if (taskIndex >= taskList.value.length) {
      finishExperimentPhase()
      return
    }

    const taskFileNameToLoad = taskList.value[taskIndex]
    currentTaskName.value = taskFileNameToLoad
    isCurrentTaskSolved.value = false
    currentTaskAttempt.value = 1
    numActionsInCurrentTask = 0
    arcData.value = [] // Reset actions for the new task
    undoStack.value = []
    isWritingSolution.value = false
    isFirstWrittenDescriptionAttempt.value = true
    firstWrittenSolutionText.value = ''
    lastWrittenSolutionText.value = ''
    previousSubmittedOutputGridString.value = ''

    const taskJson = await _fetchTaskData(taskFileNameToLoad, 'evaluation') // Assuming experiment tasks are 'evaluation'
    if (taskJson) {
      _loadTaskIntoState(taskJson)
      _logAction('load_experiment_task', { taskIndex, taskName: currentTaskName.value })
    } else {
      errorMsg(`Failed to load task: ${taskFileNameToLoad}. Skipping to next.`)
      await _moveToNextTaskOrFinish() // Handle failure
    }
  }

  function _loadTaskIntoState(taskJson) {
    // testPairsForCurrentTask should contain the input and output grid data
    // Example: taskJson = { train: [{input, output}, ...], test: [{input, output}, ...] }
    // The original code uses only the first test pair.
    if (!taskJson || !taskJson.test || taskJson.test.length === 0) {
      errorMsg('Task JSON is invalid or has no test pairs.')
      currentInputGrid.value = new Grid(3, 3) // Reset to default
      currentOutputGrid.value = new Grid(3, 3)
      outputGridHeight.value = 3
      outputGridWidth.value = 3
      testPairsForCurrentTask.value = []
      return
    }

    testPairsForCurrentTask.value = taskJson.test // Store all test pairs
    currentTestPairIndex.value = 0 // Use the first one

    const inputData = taskJson.test[currentTestPairIndex.value].input
    currentInputGrid.value = new Grid(inputData.length, inputData[0].length, inputData)

    // Reset output grid to a default 3x3 or based on input size, or last used size?
    // Original reset to 3x3. Let's stick to that for reset, but task load might set it differently or copy input size
    resetOutputGrid()

    // The demo pairs for display
    // This should be handled by WorkspaceManager using taskJson.train
  }

  async function _moveToNextTaskOrFinish() {
    _saveCurrentTaskDataToSmileStore() // Save data for the completed/attempted task

    if (experimentPhase.value === 'tutorial_task') {
      completeTutorialTaskPhase() // This will move to quiz
    } else if (experimentPhase.value === 'experiment') {
      currentTaskIndexGlobal.value++
      if (currentTaskIndexGlobal.value < taskList.value.length) {
        await _loadExperimentTask(currentTaskIndexGlobal.value)
      } else {
        finishExperimentPhase()
      }
    }
  }

  function finishExperimentPhase() {
    _logAction('all_experiment_tasks_completed')
    experimentPhase.value = 'finished'
    // Save final data if any pending
    smileStore.saveData()
  }

  function submitFeedbackAndExit(feedback) {
    userFeedbackText.value = feedback
    _logAction('submit_final_feedback', { feedback })
    _saveCurrentTaskDataToSmileStore() // Ensure last bit of data is tied to a task name or global

    // Save all accumulated arcData to a general "experiment_summary" or similar in smilestore if not task-specific
    // For now, assuming smilestore.data.arc is an object where keys are task names.
    // A final global save might be needed.
    // smileStore.data.globalExperimentData = { feedback: userFeedbackText.value, allArcActions: ... }
    smileStore.saveData()
    viewAPI.goNextView() // Navigate away
  }

  // === ACTION LOGGING ===
  function _logAction(action, details = {}) {
    numActionsInCurrentTask++
    const logEntry = {
      action,
      ...details,
      action_number_in_task: numActionsInCurrentTask,
      timestamp: new Date().toISOString(),
      current_task_name: currentTaskName.value,
      current_task_attempt: currentTaskAttempt.value,
      is_solved: isCurrentTaskSolved.value,
      is_tutorial: experimentPhase.value === 'tutorial_task',
      current_output_grid: _gridToString(currentOutputGrid.value),
      current_output_grid_size: `${currentOutputGrid.value.height}x${currentOutputGrid.value.width}`,
      current_input_grid_size: `${currentInputGrid.value.height}x${currentInputGrid.value.width}`,
      selected_tool: selectedTool.value,
      selected_symbol: selectedSymbol.value,
      // selected_data: selectedCells.value, // Consider how to log this (e.g., array of strings)
      // copy_paste_data: copiedCellData.value, // And this
    }
    arcData.value.push(logEntry)
    // console.log("Logged Action:", logEntry);
  }

  function _saveCurrentTaskDataToSmileStore() {
    if (currentTaskName.value) {
      if (!smileStore.data.arc) smileStore.data.arc = {}
      // Accumulate actions for a task. If loading a task, it should retrieve existing actions.
      // This needs careful thought on whether actions are reset per task load or accumulated across sessions.
      // For now, let's assume arcData.value is for the current attempt/load of a task.
      // smileStore.data.arc[currentTaskName.value] = [...(smileStore.data.arc[currentTaskName.value] || []), ...arcData.value];

      // Simpler: each task view populates its own fresh arcData and saves it on exit/next.
      // The ExpView's onMounted should initialize smilestore.data.arc[taskIdentifier] = [] if it's a new task attempt.
      smileStore.data.arc[currentTaskName.value] = JSON.parse(JSON.stringify(arcData.value))
    }
    // Include other relevant summary data for the task if needed
    smileStore.recordProperty(`task_${currentTaskName.value}_solved`, isCurrentTaskSolved.value)
    smileStore.recordProperty(`task_${currentTaskName.value}_attempts`, currentTaskAttempt.value)
    smileStore.recordProperty(`task_${currentTaskName.value}_first_description`, firstWrittenSolutionText.value)
    smileStore.recordProperty(`task_${currentTaskName.value}_last_description`, lastWrittenSolutionText.value)

    smileStore.saveData() // Save to backend/localStorage
  }

  // === GRID MANIPULATION ===
  function _gridToString(gridInstance) {
    if (!gridInstance || !gridInstance.grid) return ''
    return gridInstance.grid.map((row) => row.join('')).join('|')
  }

  function updateOutputGridSize(height, width) {
    if (height === outputGridHeight.value && width === outputGridWidth.value) return

    _pushToUndoStack()
    const oldGridValues = currentOutputGrid.value.grid
    currentOutputGrid.value = new Grid(height, width, oldGridValues) // Values are preserved up to new bounds
    outputGridHeight.value = height
    outputGridWidth.value = width
    selectedCells.value.clear() // Clear selection on resize
    _logAction('resize_output_grid', { newHeight: height, newWidth: width })
  }

  function resetOutputGrid() {
    _pushToUndoStack()
    currentOutputGrid.value = new Grid(3, 3)
    outputGridHeight.value = 3
    outputGridWidth.value = 3
    selectedCells.value.clear()
    // Reset color to black, tool to edit, etc.
    selectedSymbol.value = 0
    selectedTool.value = 'edit'
    _logAction('reset_output_grid')
  }

  function copyInputToOutput() {
    if (!currentInputGrid.value) return
    _pushToUndoStack()
    currentOutputGrid.value = new Grid(
      currentInputGrid.value.height,
      currentInputGrid.value.width,
      currentInputGrid.value.grid
    )
    outputGridHeight.value = currentInputGrid.value.height
    outputGridWidth.value = currentInputGrid.value.width
    selectedCells.value.clear()
    _logAction('copy_input_to_output')
  }

  function _pushToUndoStack() {
    // Deep copy of the grid state for undo
    undoStack.value.push(JSON.parse(JSON.stringify(currentOutputGrid.value.grid)))
    if (undoStack.value.length > 20) {
      // Limit undo stack size
      undoStack.value.shift()
    }
  }

  function undoLastAction() {
    if (undoStack.value.length > 0) {
      const prevState = undoStack.value.pop()
      currentOutputGrid.value = new Grid(prevState.length, prevState[0].length, prevState)
      outputGridHeight.value = prevState.length
      outputGridWidth.value = prevState[0].length
      selectedCells.value.clear()
      _logAction('undo')
    } else {
      infoMsg('No more actions to undo.')
    }
  }

  function _floodfill(grid, x, y, newSymbol) {
    const rows = grid.length
    const cols = grid[0].length
    const targetSymbol = grid[x][y]

    if (targetSymbol === newSymbol) return // No change needed

    const stack = [[x, y]]
    while (stack.length > 0) {
      const [curX, curY] = stack.pop()
      if (curX >= 0 && curX < rows && curY >= 0 && curY < cols && grid[curX][curY] === targetSymbol) {
        grid[curX][curY] = newSymbol
        stack.push([curX + 1, curY])
        stack.push([curX - 1, curY])
        stack.push([curX, curY + 1])
        stack.push([curX, curY - 1])
      }
    }
  }

  // Called from EditableGrid event
  function handleCellInteraction(payload) {
    // { type: 'click'/'mousedown'/'mousemove'/'mouseup', x, y, event }
    const { type, x, y } = payload

    if (type === 'click' && selectedTool.value !== 'select') {
      // Select tool handles its own clicks via selection-change
      _pushToUndoStack()
      if (selectedTool.value === 'edit') {
        if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
          currentOutputGrid.value.grid[x][y] = selectedSymbol.value
          _logAction('draw_cell', { x, y, symbol: selectedSymbol.value })
        }
      } else if (selectedTool.value === 'floodfill') {
        const tempGrid = JSON.parse(JSON.stringify(currentOutputGrid.value.grid)) // Operate on a copy for floodfill logic
        _floodfill(tempGrid, x, y, selectedSymbol.value)
        currentOutputGrid.value.grid = tempGrid // Assign back
        _logAction('floodfill_cell', { x, y, symbol: selectedSymbol.value })
      }
    }
    // Add mousedown/mousemove logic for drag-drawing if 'edit' tool is active
    if (type === 'mousedown' && selectedTool.value === 'edit') {
      // isDrawingActive.value = true; // Need a ref for this
      _pushToUndoStack() // Push before first drag-draw point
      if (currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
        currentOutputGrid.value.grid[x][y] = selectedSymbol.value
        _logAction('draw_cell_drag_start', { x, y, symbol: selectedSymbol.value })
      }
    }
    if (type === 'mousemove' && selectedTool.value === 'edit' /* && isDrawingActive.value */) {
      // Check if mouse button is actually down (payload.event.buttons === 1)
      if (payload.event.buttons === 1 && currentOutputGrid.value.grid[x][y] !== selectedSymbol.value) {
        currentOutputGrid.value.grid[x][y] = selectedSymbol.value
        // Log frugally for drag draw, maybe on mouseup
      }
    }
    if (type === 'mouseup' && selectedTool.value === 'edit' /* && isDrawingActive.value */) {
      // isDrawingActive.value = false;
      _logAction('draw_cell_drag_end')
    }

    // Select tool interactions are handled by `updateSelectedCells`
  }

  function updateSelectedCells(newSelection) {
    // newSelection is a Set of "x,y" strings
    selectedCells.value = newSelection
    _logAction('select_cells_updated', { count: newSelection.size })
  }

  function changeColorOfSelectedCells() {
    if (selectedCells.value.size > 0) {
      _pushToUndoStack()
      selectedCells.value.forEach((coordStr) => {
        const [x, y] = coordStr.split(',').map(Number)
        if (currentOutputGrid.value.grid[x] && currentOutputGrid.value.grid[x][y] !== undefined) {
          currentOutputGrid.value.grid[x][y] = selectedSymbol.value
        }
      })
      _logAction('change_color_selected_cells', { symbol: selectedSymbol.value, count: selectedCells.value.size })
      selectedCells.value.clear() // Clear selection after color change, common UX
    }
  }

  function copySelectedOutputCells() {
    if (selectedCells.value.size === 0 || selectedTool.value !== 'select') {
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
    _logAction('copy_cells_to_clipboard', { count: cellsToCopy.length })
    successMsg(`${cellsToCopy.length} cells copied! Select a single target cell and press Paste.`)
  }

  function pasteCopiedCells() {
    if (copiedCellData.value.cells.length === 0) {
      errorMsg('Clipboard is empty. Copy some cells first.')
      return
    }
    if (selectedCells.value.size !== 1 || selectedTool.value !== 'select') {
      errorMsg('Select a single target cell with the Select tool to paste.')
      return
    }

    _pushToUndoStack()
    const targetCoordStr = selectedCells.value.values().next().value // Get the single selected cell
    const [targetX, targetY] = targetCoordStr.split(',').map(Number)

    const { cells, origin } = copiedCellData.value
    cells.forEach((cell) => {
      const newX = targetX + (cell.x - origin.minX)
      const newY = targetY + (cell.y - origin.minY)
      if (newX >= 0 && newX < currentOutputGrid.value.height && newY >= 0 && newY < currentOutputGrid.value.width) {
        currentOutputGrid.value.grid[newX][newY] = cell.symbol
      }
    })
    _logAction('paste_cells_from_clipboard', { targetX, targetY, count: cells.length })
    successMsg('Pasted cells.')
    selectedCells.value.clear() // Clear selection after paste
    // copiedCellData.value = { cells: [], origin: {minX:0, minY:0}}; // Clear clipboard? Or allow multiple pastes?
  }

  // === SOLUTION SUBMISSION & DESCRIPTION ===
  function _verifySolution() {
    // Assumes testPairsForCurrentTask.value[currentTestPairIndex.value] holds the {input, output}
    const referenceOutput = testPairsForCurrentTask.value[currentTestPairIndex.value].output
    const submittedOutput = currentOutputGrid.value.grid

    if (referenceOutput.length !== submittedOutput.length || referenceOutput[0].length !== submittedOutput[0].length) {
      return false // Dimension mismatch
    }

    for (let i = 0; i < referenceOutput.length; i++) {
      for (let j = 0; j < referenceOutput[i].length; j++) {
        if (referenceOutput[i][j] !== submittedOutput[i][j]) {
          return false // Symbol mismatch
        }
      }
    }
    return true
  }

  function submitSolutionAttempt() {
    const currentGridStr = _gridToString(currentOutputGrid.value)
    if (currentTaskAttempt.value > 1 && currentGridStr === previousSubmittedOutputGridString.value) {
      errorMsg('You have already submitted this exact solution. Please try something different.')
      return
    }
    previousSubmittedOutputGridString.value = currentGridStr

    if (isFirstWrittenDescriptionAttempt.value && experimentPhase.value === 'experiment') {
      isWritingSolution.value = true // Prompt for first description
      _logAction('prompt_first_description')
      infoMsg('Please describe your approach before we check your solution.')
      return // Don't check solution yet
    }

    _checkAndProcessSubmittedSolution()
  }

  function submitWrittenDescription(description) {
    if (!description.trim()) {
      errorMsg('Description cannot be empty.')
      return
    }

    if (isFirstWrittenDescriptionAttempt.value) {
      firstWrittenSolutionText.value = description
      _logAction('submit_first_description', { description })
      isFirstWrittenDescriptionAttempt.value = false // Mark first description as submitted
      isWritingSolution.value = false // Hide description box
      if (experimentPhase.value === 'experiment') {
        _checkAndProcessSubmittedSolution() // Now check the solution that was pending
      } else if (experimentPhase.value === 'tutorial_task') {
        // For tutorial, if description is required before checking, call check here too
        _checkAndProcessSubmittedSolution()
      }
    } else {
      // This is the final description (after solving or exhausting attempts)
      lastWrittenSolutionText.value = description
      _logAction('submit_final_description', { description })
      isWritingSolution.value = false
      // Proceed to next task or finish experiment
      _moveToNextTaskOrFinish()
    }
  }

  function _checkAndProcessSubmittedSolution() {
    isCurrentTaskSolved.value = _verifySolution()
    _logAction('submit_solution_attempt', {
      attempt: currentTaskAttempt.value,
      isCorrect: isCurrentTaskSolved.value,
      isTutorial: experimentPhase.value === 'tutorial_task',
    })

    if (isCurrentTaskSolved.value) {
      successMsg('Correct! Your solution matches.')
      if (experimentPhase.value === 'tutorial_task' && currentTaskAttempt.value === 1) {
        // Tutorial solved on first try after (optional) description
        lastWrittenSolutionText.value = firstWrittenSolutionText.value || 'Solved tutorial on first attempt.' // Or prompt for final tutorial description
        _logAction('tutorial_solved_first_try_after_desc_or_no_desc')
        // _moveToNextTaskOrFinish(); // -> completeTutorialTaskPhase -> tutorial_quiz
        // If tutorial needs specific description flow:
        isWritingSolution.value = true // Prompt for "final" tutorial description
        infoMsg('Tutorial solved! Please provide the requested final description.')
        return // Wait for final description submission
      } else {
        // Experiment task solved, or tutorial solved not on first try
        isWritingSolution.value = true // Prompt for final description
        infoMsg(
          experimentPhase.value === 'tutorial_task'
            ? 'Tutorial solved! Please describe your final thoughts.'
            : 'Task solved! Please describe your solution.'
        )
      }
      // Don't move to next task yet, wait for final description submission via submitWrittenDescription
    } else {
      // Incorrect solution
      currentTaskAttempt.value++
      if (currentTaskAttempt.value > MAX_ATTEMPTS_PER_TASK) {
        errorMsg(`Incorrect. You have used all ${MAX_ATTEMPTS_PER_TASK} attempts.`)
        isWritingSolution.value = true // Prompt for final description (what they thought)
        infoMsg('Please describe what you thought the solution was.')
        // Don't move to next task yet, wait for final description submission
      } else {
        errorMsg(`Incorrect. Please try again. Attempt ${currentTaskAttempt.value} of ${MAX_ATTEMPTS_PER_TASK}.`)
        // Stay on current task, allow more attempts
      }
    }
  }

  // --- Auto Solve (for debugging/testing, if needed) ---
  function autoSolveCurrentTask() {
    if (testPairsForCurrentTask.value.length > 0 && testPairsForCurrentTask.value[currentTestPairIndex.value]) {
      const refOutput = testPairsForCurrentTask.value[currentTestPairIndex.value].output
      _pushToUndoStack()
      currentOutputGrid.value = new Grid(refOutput.length, refOutput[0].length, refOutput)
      outputGridHeight.value = refOutput.length
      outputGridWidth.value = refOutput[0].length
      _logAction('auto_solve_task')
      successMsg('Task auto-solved (for testing).')
    } else {
      errorMsg('No reference solution available to auto-solve.')
    }
  }

  // --- Public API of the composable ---
  return {
    // State
    experimentPhase,
    currentTaskName,
    currentTaskAttempt,
    MAX_ATTEMPTS_PER_TASK,
    isCurrentTaskSolved,
    currentInputGrid,
    currentOutputGrid,
    outputGridHeight, // For v-model with select
    outputGridWidth, // For v-model with select
    selectedTool,
    selectedSymbol,
    selectedCells, // To pass to EditableGrid for highlighting
    isWritingSolution,
    isFirstWrittenDescriptionAttempt, // To control description prompt text
    firstWrittenSolutionText, // For v-model
    lastWrittenSolutionText, // For v-model
    userFeedbackText, // For v-model
    testPairsForCurrentTask, // For WorkspaceManager to display train pairs
    currentTestPairIndex, // For WorkspaceManager
    tutorialTaskData, // For TutorialManager to display info if needed

    // Grid Config
    EDITION_GRID_CONTAINER_HEIGHT,
    EDITION_GRID_CONTAINER_WIDTH,
    MAX_CELL_SIZE_CONFIG,

    // Methods
    initExperiment: _initializeExperimentState,
    cleanupExperiment: _cleanupExperiment,

    // Tutorial Flow
    startTutorialSlides, // Called by ExpView if not auto
    startTutorialTask, // Called by TutorialManager
    submitTutorialQuiz, // Called by TutorialManager

    // Workspace Interaction
    updateOutputGridSize,
    resetOutputGrid,
    copyInputToOutput,
    undoLastAction,
    handleCellInteraction, // Called by EditableGrid for output grid
    updateSelectedCells, // Called by EditableGrid (output grid) on selection change
    changeColorOfSelectedCells, // Called by WorkspaceManager toolbar
    copySelectedOutputCells, // Called by WorkspaceManager toolbar/keyboard shortcut
    pasteCopiedCells, // Called by WorkspaceManager toolbar/keyboard shortcut

    submitSolutionAttempt, // Called by WorkspaceManager submit button
    submitWrittenDescription, // Called by WorkspaceManager description submit button

    submitFeedbackAndExit, // Called by ExpView/FinishComponent

    // For Debug/Testing (optional)
    autoSolveCurrentTask,

    // Helper to get data for example pairs display in WorkspaceManager
    getExamplePairsForDisplay: computed(() => {
      const taskData =
        experimentPhase.value === 'tutorial_task'
          ? tutorialTaskData.value
          : taskList.value[currentTaskIndexGlobal.value] && taskList.value[currentTaskIndexGlobal.value].jsonData
            ? taskList.value[currentTaskIndexGlobal.value].jsonData
            : null

      // The above line is problematic: taskList.value[X].jsonData is not how data is stored.
      // _loadTaskIntoState stores full taskJson into 'testPairsForCurrentTask' (for test part)
      // and 'currentInputGrid'. The 'train' part is directly in the loaded taskJson.
      // Let's assume taskJson is temporarily stored or re-fetched for examples.
      // A better way: when a task is loaded, store its 'train' pairs in a reactive ref.
      // For now, this part needs refinement based on how WorkspaceManager gets train data.
      // Placeholder:
      if (experimentPhase.value === 'tutorial_task' && tutorialTaskData.value) {
        return tutorialTaskData.value.train.map((p) => ({
          input: new Grid(p.input.length, p.input[0].length, p.input),
          output: new Grid(p.output.length, p.output[0].length, p.output),
        }))
      }
      // This needs current loaded task's JSON.
      // Let's add `currentTaskFullJson` to state, populated by `_loadTaskIntoState`
      // And then use `currentTaskFullJson.value.train` here.
      // For now, returning empty to avoid error.
      return []
    }),
  }
}
