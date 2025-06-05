import { ref, computed, watch, nextTick } from 'vue'
import { Grid, fetchTaskData, verifySolution, createLogEntry } from '@/user/utils/arcUtils.js'
import { EXPERIMENT_CONFIG, GRID_CONFIG } from '@/user/utils/arcConstants.js'
import { errorMsg, infoMsg, successMsg } from '@/user/utils/uiUtils.js'
import useGridManipulation from '@/user/composables/useGridManipulation.js'

export default function useArcTaskLogic(taskFileName, taskIndex, datasetType, isTutorialMode, smilestore, viewApi) {
  // --- Task Specific State ---
  const taskName = ref(taskFileName)
  const isTutorial = ref(isTutorialMode)
  const taskData = ref(null)
  const arcLogEntries = ref([])

  const currentInputGrid = ref(new Grid(GRID_CONFIG.DEFAULT_HEIGHT, GRID_CONFIG.DEFAULT_WIDTH))
  const testPairForTask = ref(null)

  const currentAttempt = ref(1)
  const isSolved = ref(false)
  let numActionsInTask = 0

  const previousSubmittedOutputGridString = ref('')

  // --- Solution Description State ---
  const isWritingDescription = ref(false)
  const isFirstDescriptionAttemptForTask = ref(true)
  const firstDescriptionText = ref('')
  const finalDescriptionText = ref('')

  // --- Grid Manipulation ---
  const {
    currentOutputGrid,
    outputGridHeight,
    outputGridWidth,
    selectedTool,
    selectedSymbol,
    selectedCells,
    selectedInputCells,
    updateOutputGridSize,
    resetOutputGrid,
    copyInputToOutput,
    undoLastAction,
    handleCellInteraction,
    updateSelectedCells,
    updateSelectedInputCells,
    changeColorOfSelectedCells,
    copySelectedCells,
    pasteCopiedCells,
    autoSolve,
    copiedCellData,
  } = useGridManipulation(logActionInternal)

  // === LOGGING ===
  function logActionInternal(action, details = {}) {
    numActionsInTask++

    // Helper functions to serialize grid state
    const getOutputGridString = () => {
      return currentOutputGrid.value ? JSON.stringify(currentOutputGrid.value.grid) : ''
    }

    const getInputGridString = () => {
      return currentInputGrid.value ? JSON.stringify(currentInputGrid.value.grid) : ''
    }

    const logEntry = createLogEntry(action, {
      task_name: taskName.value,
      task_index: taskIndex,
      dataset_type: datasetType,
      is_tutorial: isTutorial.value,
      attempt_for_task: currentAttempt.value,
      action_number_in_task: numActionsInTask,
      task_is_solved: isSolved.value,

      // Grid state information
      test_output_grid: getOutputGridString(),
      test_output_size: [outputGridHeight.value, outputGridWidth.value],
      test_input_grid: getInputGridString(),
      test_input_size: currentInputGrid.value ? [currentInputGrid.value.height, currentInputGrid.value.width] : [0, 0],

      // UI state
      selected_tool: selectedTool.value,
      selected_symbol: selectedSymbol.value,
      selected_cells: Array.from(selectedCells.value),

      ...details,
    })
    arcLogEntries.value.push(logEntry)
  }

  function saveTaskDataToSmileStore() {
    if (taskIndex !== undefined) {
      if (!smilestore.data.arc) smilestore.data.arc = {}
      smilestore.data.arc[taskIndex] = {
        taskName: taskName.value,
        datasetType: datasetType,
        isSolved: isSolved.value,
        attempts: currentAttempt.value,
        firstDescription: firstDescriptionText.value,
        finalDescription: finalDescriptionText.value,
        actionLogs: JSON.parse(JSON.stringify(arcLogEntries.value)),
      }
      smilestore.saveData()
    }
  }

  // === TASK LOADING ===
  async function loadTask() {
    numActionsInTask = 0
    arcLogEntries.value = []
    isSolved.value = false
    currentAttempt.value = 1
    isWritingDescription.value = false
    isFirstDescriptionAttemptForTask.value = true
    firstDescriptionText.value = ''
    finalDescriptionText.value = ''
    selectedCells.value.clear()
    selectedInputCells.value.clear()
    previousSubmittedOutputGridString.value = ''

    taskData.value = await fetchTaskData(taskName.value, datasetType, viewApi)

    if (!taskData.value || !taskData.value.test || taskData.value.test.length === 0) {
      logActionInternal('load_task_failed', { name: taskName.value, error: 'Invalid task JSON' })
      return
    }

    testPairForTask.value = taskData.value.test[0]
    const inputData = testPairForTask.value.input
    currentInputGrid.value = new Grid(inputData.length, inputData[0].length, inputData)

    resetOutputGrid()
    logActionInternal('load_task_success', { name: taskName.value })
  }

  // === SOLUTION SUBMISSION ===
  function handleSubmitAttempt() {
    const currentGridStr = JSON.stringify(currentOutputGrid.value.grid)
    if (currentAttempt.value > 1 && currentGridStr === previousSubmittedOutputGridString.value) {
      errorMsg('You have already submitted this exact solution. Please try something different.')
      return
    }
    previousSubmittedOutputGridString.value = currentGridStr

    if (isFirstDescriptionAttemptForTask.value && !isTutorial.value) {
      isWritingDescription.value = true
      logActionInternal('prompt_first_description')
      infoMsg('Please describe your approach before we check your solution.')
      return
    }
    checkAndProcessSubmittedSolution()
  }

  function submitTaskDescription(descriptionText) {
    if (!descriptionText.trim()) {
      errorMsg('Description cannot be empty.')
      return
    }

    if (isFirstDescriptionAttemptForTask.value && !isTutorial.value) {
      firstDescriptionText.value = descriptionText
      logActionInternal('submit_first_description', { description: descriptionText })
      isFirstDescriptionAttemptForTask.value = false
      isWritingDescription.value = false
      checkAndProcessSubmittedSolution()
    } else {
      finalDescriptionText.value = descriptionText
      logActionInternal('submit_final_description', { description: descriptionText })
      isWritingDescription.value = false
      finishTask()
    }
  }

  function checkAndProcessSubmittedSolution() {
    isSolved.value = verifySolution(testPairForTask.value?.output, currentOutputGrid.value)
    logActionInternal('submit_solution_check', {
      attemptNumber: currentAttempt.value,
      isCorrect: isSolved.value,
    })

    if (isSolved.value) {
      successMsg('Correct! Your solution matches.')
      isWritingDescription.value = true
      infoMsg(
        isTutorial.value
          ? 'Tutorial solved! Please provide the final description.'
          : 'Task solved! Please describe your solution.'
      )
    } else {
      currentAttempt.value++
      if (currentAttempt.value > EXPERIMENT_CONFIG.MAX_ATTEMPTS_PER_TASK) {
        errorMsg(`Incorrect. You have used all ${EXPERIMENT_CONFIG.MAX_ATTEMPTS_PER_TASK} attempts for this task.`)
        isWritingDescription.value = true
        infoMsg('Please describe what you thought the solution was.')
      } else {
        errorMsg(
          `Incorrect. Please try again. Attempt ${currentAttempt.value} of ${EXPERIMENT_CONFIG.MAX_ATTEMPTS_PER_TASK}.`
        )
      }
    }
  }

  let parentFinishCallback = null
  function onFinish(cb) {
    parentFinishCallback = cb
  }

  function finishTask() {
    saveTaskDataToSmileStore()
    if (parentFinishCallback) parentFinishCallback()
  }

  // Wrapper functions for grid manipulation to maintain API compatibility
  function handleCellInteractionWrapper(payload) {
    handleCellInteraction(payload)
  }

  function updateSelectedCellsOnOutputGrid(newSelection) {
    updateSelectedCells(newSelection)
  }

  function updateSelectedCellsOnInputGrid(newSelection) {
    updateSelectedInputCells(newSelection)
  }

  function copyFromSelectedCells() {
    copySelectedCells(currentInputGrid.value)
  }

  function pasteToOutputCells() {
    pasteCopiedCells()
  }

  function changeColorOfSelectedOutputCells() {
    changeColorOfSelectedCells()
  }

  function copyInputToOutputWrapper() {
    copyInputToOutput(currentInputGrid.value)
  }

  function autoSolveWrapper() {
    autoSolve(testPairForTask.value?.output)
  }

  function resetOutputGridWrapper() {
    resetOutputGrid()
  }

  // Add debugging right after the refs are destructured
  console.log('Initial grid dimensions:', {
    height: outputGridHeight.value,
    width: outputGridWidth.value,
  })

  return {
    // Task Info
    taskName,
    isTutorial,
    taskData,
    currentInputGrid,
    currentOutputGrid,
    currentAttempt,
    MAX_ATTEMPTS: EXPERIMENT_CONFIG.MAX_ATTEMPTS_PER_TASK,
    isSolved,

    // UI State
    selectedTool,
    selectedSymbol,
    outputGridHeight,
    outputGridWidth,
    selectedCells,
    selectedInputCells,
    copiedCellData,
    isWritingDescription,
    isFirstDescriptionAttemptForTask,
    firstDescriptionText,
    finalDescriptionText,

    // Grid Config
    EDITION_GRID_CONTAINER_HEIGHT: GRID_CONFIG.EDITION_CONTAINER_HEIGHT,
    EDITION_GRID_CONTAINER_WIDTH: GRID_CONFIG.EDITION_CONTAINER_WIDTH,
    MAX_CELL_SIZE_CONFIG: GRID_CONFIG.MAX_CELL_SIZE,

    // Methods
    loadTask,
    updateOutputGridSize,
    resetOutputGrid: resetOutputGridWrapper,
    copyInputToOutput: copyInputToOutputWrapper,
    undoLastAction,
    handleCellInteraction: handleCellInteractionWrapper,
    updateSelectedCellsOnOutputGrid,
    updateSelectedCellsOnInputGrid,
    changeColorOfSelectedOutputCells,
    copyFromSelectedCells,
    pasteToOutputCells,
    handleSubmitAttempt,
    submitTaskDescription,
    autoSolve: autoSolveWrapper,
    onFinish,
  }
}
