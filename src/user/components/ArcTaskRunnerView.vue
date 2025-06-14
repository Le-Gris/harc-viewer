<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import useArcTaskLogic from '@/user/composables/useArcTaskLogic.js';
import EditableGrid from '@/user/components/EditableGrid.vue';
import useViewAPI from '@/core/composables/useViewAPI';
import useSmileStore from "@/core/stores/smilestore";

const props = defineProps({
    taskFileName: {
        type: String,
        required: true,
    },
    datasetType: {
        type: String,
        required: true,
        validator: (value) => ['training', 'evaluation'].includes(value),
    },
    isTutorialMode: {
        type: Boolean,
        default: false,
    },
    // Other props needed from design.js
    taskNumber: Number,
    totalTasks: Number,
});

const viewApi = useViewAPI();
const smilestore = useSmileStore();

const taskLogic = useArcTaskLogic(props.taskFileName, props.taskNumber, props.datasetType, props.isTutorialMode, smilestore, viewApi);

const localDescriptionModel = ref(""); // For the textarea

onMounted(() => {
    taskLogic.loadTask();
    taskLogic.onFinish(() => {
        // Task logic signals it's finished (solved/exhausted & description submitted)
        viewApi.goNextView();
    });
});

// Keep localDescriptionModel in sync with taskLogic's description state
watch(() => taskLogic.isWritingDescription.value, (isWriting) => {
    if (isWriting) {
        localDescriptionModel.value = taskLogic.isFirstDescriptionAttemptForTask.value ?
            taskLogic.firstDescriptionText.value :
            taskLogic.finalDescriptionText.value;
    }
}, { immediate: true });

watch(() => taskLogic.firstDescriptionText.value, (newVal) => {
    if (taskLogic.isWritingDescription.value && taskLogic.isFirstDescriptionAttemptForTask.value) {
        localDescriptionModel.value = newVal;
    }
});
watch(() => taskLogic.finalDescriptionText.value, (newVal) => {
    if (taskLogic.isWritingDescription.value && !taskLogic.isFirstDescriptionAttemptForTask.value) {
        localDescriptionModel.value = newVal;
    }
});


function handleDescriptionSubmit() {
    taskLogic.submitTaskDescription(localDescriptionModel.value);
    // localDescriptionModel.value = ""; // taskLogic will handle clearing or moving to next state
}

const trainPairsForDisplay = computed(() => {
    if (taskLogic.taskData.value && taskLogic.taskData.value.train) {
        return taskLogic.taskData.value.train.map((pair, index) => ({
            id: `train_pair_${index}`,
            // Need to ensure Grid class is accessible or re-instantiate here
            // Assuming Grid class is part of taskLogic or globally available
            inputGrid: new taskLogic.currentInputGrid.value.constructor(pair.input.length, pair.input[0].length, pair.input),
            outputGrid: new taskLogic.currentInputGrid.value.constructor(pair.output.length, pair.output[0].length, pair.output),
        }));
    }
    return [];
});

const infoBarText = computed(() => {
    let text = props.isTutorialMode ? `Tutorial Task: ${props.taskFileName}` :
        `Task ${props.taskNumber || '-'}/${props.totalTasks || '-'}`;
    text += ` | Attempt: ${taskLogic.currentAttempt.value}/${taskLogic.MAX_ATTEMPTS}`;
    // if (taskLogic.isSolved.value) text += " (Solved)";
    return text;
});

const descriptionPromptText = computed(() => {
    if (!taskLogic.isWritingDescription.value) return "";
    if (props.isTutorialMode) {
        return "Before you receive feedback, you will be asked to describe your solution. After you submit either three incorrect solutions or one correct solution you will be asked for a final description. If you get it right on the first attempt you will not be asked for another description. For this tutorial please write the following solution to this task: <strong>Create a checkerboard pattern by alternating between the two colors in each row.</strong> This solution is approximately the length and generality we hope for in your responses. When you are done, please press the 'Submit description' button to continue.";
    }
    if (taskLogic.isFirstDescriptionAttemptForTask.value | taskLogic.isSolved.value) {
        return "Please describe what you thought the rule was to transform the input to the output for this task. When you are done, please press the 'Submit Description' button to continue.";
    }
    return "You've used all attempts. Please describe what you thought the rule was.";
});


// Help Modal Logic
const showHelp = ref(false);
function toggleHelpModal() {
    showHelp.value = !showHelp.value;
    if (showHelp.value) {
        // taskLogic._logActionInternal('show_help_modal'); // If direct logging is desired
    }
}

// Keyboard Shortcuts for Copy/Paste (C/V)
function handleKeyDown(event) {
    if (taskLogic.isWritingDescription.value) return;

    const activeElTag = document.activeElement.tagName;
    if (activeElTag === 'INPUT' || activeElTag === 'TEXTAREA') return;


    if ((event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey)) {
        // Standard browser copy should work if text is selected.
        // This is for grid copy.
        if (taskLogic.selectedTool.value === 'select' && taskLogic.selectedCells.value.size > 0) {
            event.preventDefault();
            taskLogic.copyFromSelectedCells();
        }
    }
    if ((event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey)) {
        if (taskLogic.selectedTool.value === 'select' && taskLogic.copiedCellData.value.cells.length > 0) {
            event.preventDefault();
            taskLogic.pasteToOutputCells();
        }
    }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));

// Helper function for color tooltips
function getColorName(colorIndex) {
    const colorNames = [
        '(Black)', '(Blue)', '(Red)', '(Green)', '(Yellow)',
        '(Gray)', '(Pink)', '(Orange)', '(Light Blue)', '(Brown)'
    ];
    return colorNames[colorIndex] || '';
}

const gridHeight = computed({
    get: () => taskLogic.outputGridHeight.value,
    set: (val) => {
        const newVal = Number(val);
        taskLogic.updateOutputGridSize(newVal, taskLogic.outputGridWidth.value);
    }
});

const gridWidth = computed({
    get: () => taskLogic.outputGridWidth.value,
    set: (val) => {
        const newVal = Number(val);
        taskLogic.updateOutputGridSize(taskLogic.outputGridHeight.value, newVal);
    }
});

</script>

<template>
    <div class="arc-task-runner-view">
        <div id="task_info_bar_vue" class="info-bar">{{ infoBarText }}</div>

        <div class="content-wrapper">
            <!-- Task Demonstration Examples -->
            <div id="demonstration_examples_view_vue" class="panel examples-panel">
                <h3 class="panel-title">Task Demonstration</h3>
                <div v-if="trainPairsForDisplay.length === 0">Loading examples...</div>
                <div v-for="(pair, index) in trainPairsForDisplay" :key="pair.id" class="example-pair">
                    <div class="grid-group">
                        <div class="grid-header">Example Input {{ index + 1 }}</div>
                        <EditableGrid :gridInstance="pair.inputGrid" :containerWidth="150" :containerHeight="150"
                            :maxCellSize="30" />
                    </div>
                    <div class="grid-group">
                        <div class="grid-header">Example Output {{ index + 1 }}</div>
                        <EditableGrid :gridInstance="pair.outputGrid" :containerWidth="150" :containerHeight="150"
                            :maxCellSize="30" />
                    </div>
                </div>
            </div>

            <!-- Evaluation View (Input, Output Editor) -->
            <div id="evaluation_view_vue" class="panel evaluation-panel">
                <div class="evaluation-grids-container">
                    <div class="grid-group test-input-group">
                        <h3 class="panel-title centered">Test Input</h3>
                        <EditableGrid :gridInstance="taskLogic.currentInputGrid.value" :containerWidth="300"
                            :containerHeight="300" :maxCellSize="30"
                            :isInteractive="taskLogic.selectedTool.value === 'select'"
                            :allowSelect="taskLogic.selectedTool.value === 'select'"
                            :selectedCells="taskLogic.selectedInputCells.value"
                            @selection-change="taskLogic.updateSelectedCellsOnInputGrid" />
                    </div>

                    <div class="grid-group test-output-group">
                        <h3 class="panel-title centered">Test Output</h3>
                        <EditableGrid :gridInstance="taskLogic.currentOutputGrid.value" :isInteractive="true"
                            :containerWidth="300" :containerHeight="300" :maxCellSize="30"
                            :allowSelect="taskLogic.selectedTool.value === 'select'"
                            :selectedCells="taskLogic.selectedCells.value" @cell-click="taskLogic.handleCellInteraction"
                            @cell-mousedown="taskLogic.handleCellInteraction"
                            @cell-mousemove="taskLogic.handleCellInteraction"
                            @cell-mouseup="taskLogic.handleCellInteraction"
                            @selection-change="taskLogic.updateSelectedCellsOnOutputGrid" />
                    </div>
                </div>

                <!-- Toolbar and Controls -->
                <div id="editor_controls_vue" class="controls-section">
                    <!-- Description Panel -->
                    <div v-if="taskLogic.isWritingDescription.value" id="write_solution_vue">
                        <h3 class="panel-title">Describe Your Solution</h3>
                        <p class="description-prompt" v-html="descriptionPromptText"></p>
                        <textarea v-model="localDescriptionModel" rows="5" placeholder="Type your description here..."
                            class="has-tooltip-arrow has-tooltip-right"
                            data-tooltip="Describe your reasoning and solution approach"></textarea>
                        <button @click="handleDescriptionSubmit"
                            class="button is-success has-tooltip-arrow has-tooltip-top"
                            data-tooltip="Submit your description">Submit
                            Description</button>
                    </div>

                    <!-- Original Controls (shown when not writing description) -->
                    <div v-show="!taskLogic.isWritingDescription.value">
                        <div class="control-row">
                            <label class="control-label">Select Tool:</label>
                            <div class="tool-options">
                                <button :class="{ active: taskLogic.selectedTool.value === 'edit' }"
                                    @click="taskLogic.selectedTool.value = 'edit'"
                                    class="has-tooltip-arrow has-tooltip-top"
                                    data-tooltip="Click cells to change their color one at a time">Edit</button>
                                <button :class="{ active: taskLogic.selectedTool.value === 'select' }"
                                    @click="taskLogic.selectedTool.value = 'select'"
                                    class="has-tooltip-arrow has-tooltip-top"
                                    data-tooltip="Click and drag to select multiple cells for bulk operations">Select</button>
                                <button :class="{ active: taskLogic.selectedTool.value === 'floodfill' }"
                                    @click="taskLogic.selectedTool.value = 'floodfill'"
                                    class="has-tooltip-arrow has-tooltip-top"
                                    data-tooltip="Click a cell to fill all connected cells of the same color">Flood
                                    Fill</button>
                            </div>
                        </div>

                        <div class="control-row">
                            <label class="control-label">Select Color:</label>
                            <div class="color-picker">
                                <span v-for="i in 10" :key="`color-${i - 1}`"
                                    :class="['symbol-preview', `symbol-${i - 1}`, { 'selected-symbol': taskLogic.selectedSymbol.value === i - 1 }, 'has-tooltip-arrow', 'has-tooltip-top']"
                                    :data-tooltip="`Select color ${i - 1} ${getColorName(i - 1)}`"
                                    @click="taskLogic.selectedSymbol.value = i - 1; taskLogic.selectedTool.value === 'select' && taskLogic.selectedCells.value.size > 0 ? taskLogic.changeColorOfSelectedOutputCells() : null">
                                </span>
                            </div>
                        </div>

                        <div class="control-row grid-size-controls">
                            <label class="control-label">Grid Size:</label>
                            <div>
                                Height: <select v-model="gridHeight" class="has-tooltip-arrow has-tooltip-top"
                                    data-tooltip="Change the height of the output grid">
                                    <option v-for="h in 30" :key="h" :value="h">{{ h }}</option>
                                </select>
                                Width: <select v-model="gridWidth" class="has-tooltip-arrow has-tooltip-top"
                                    data-tooltip="Change the width of the output grid">
                                    <option v-for="w in 30" :key="w" :value="w">{{ w }}</option>
                                </select>
                            </div>
                        </div>

                        <div class="control-row action-buttons">
                            <button @click="taskLogic.copyInputToOutput()" class="has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Copy the test input grid to the output grid as a starting point">Copy
                                Input</button>
                            <button @click="taskLogic.resetOutputGrid" class="has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Clear the output grid and reset it to a 3x3 black grid">Reset
                                Grid</button>
                            <button @click="taskLogic.undoLastAction()" class="has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Undo the last action performed on the output grid">Undo</button>
                            <button @click="toggleHelpModal" class="has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Show detailed help and instructions for using the interface">Help</button>
                        </div>

                        <div class="control-row action-buttons" v-if="taskLogic.selectedTool.value === 'select'">
                            <button @click="taskLogic.copyFromSelectedCells()"
                                :disabled="taskLogic.selectedCells.value.size === 0 && taskLogic.selectedInputCells.value.size === 0"
                                class="has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Copy selected cells (Ctrl/Cmd+C)">Copy Selection</button>
                            <button @click="taskLogic.pasteToOutputCells()"
                                :disabled="taskLogic.copiedCellData.value.cells.length === 0 || taskLogic.selectedCells.value.size !== 1"
                                class="has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Paste to Output Grid (Ctrl/Cmd+V)">Paste</button>
                        </div>

                        <div class="control-row submit-section">
                            <button @click="taskLogic.handleSubmitAttempt()"
                                class="button is-success main-submit has-tooltip-arrow has-tooltip-top"
                                data-tooltip="Submit your current output grid as the solution">Submit</button>
                            <button @click="taskLogic.autoSolve()"
                                class="submit-button debug-button has-tooltip-arrow has-tooltip-top"
                                data-tooltip="For Testing Only - Automatically solve this task">Auto-Solve</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Help Modal -->
        <div v-if="showHelp" class="modal-overlay" @click.self="toggleHelpModal">
            <div class="modal-content-viewer">
                <div class="modal-header-viewer">
                    <h3>ARC Task Help</h3>
                    <span class="close-modal-viewer" @click="toggleHelpModal">&times;</span>
                </div>
                <div class="modal-body-viewer">
                    <p>The goal is to identify the hidden rule from the "Task Demonstration" examples and apply it to
                        the "Test Input" to create the correct "Test Output".</p>
                    <h4>Tools:</h4>
                    <ul>
                        <li><strong>Edit:</strong> Click cells to change their color to the selected color. Click and
                            drag to draw.</li>
                        <li><strong>Select:</strong> Click and drag on the "Test Output" grid to select multiple cells.
                            <ul>
                                <li>Change their color by picking a new color.</li>
                                <li>Copy selection (Ctrl/Cmd+C or "Copy Sel." button).</li>
                                <li>Paste selection (Ctrl/Cmd+V or "Paste Sel." button) to a single clicked cell as the
                                    top-left anchor.</li>
                            </ul>
                        </li>
                        <li><strong>Flood Fill:</strong> Click a cell to change all connected cells of the same color to
                            the new selected color.</li>
                    </ul>
                    <h4>Controls:</h4>
                    <ul>
                        <li><strong>Color Palette:</strong> Click to select a drawing/fill color.</li>
                        <li><strong>Grid Size:</strong> Adjust the height and width of the "Test Output" grid.</li>
                        <li><strong>Copy Input:</strong> Copies the "Test Input" grid to the "Test Output" grid.</li>
                        <li><strong>Reset Output:</strong> Clears the "Test Output" grid to a default 3x3 black grid.
                        </li>
                        <li><strong>Undo:</strong> Reverts the last action on the "Test Output" grid.</li>
                    </ul>
                    <p>You have <strong>{{ taskLogic.MAX_ATTEMPTS }} attempts</strong> per task. After submitting a
                        solution, or if it's your first attempt on a non-tutorial task, you may be asked to describe
                        your reasoning.</p>
                    <p>Press <strong>Submit Solution</strong> when you think your "Test Output" is correct.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Responsive layout using viewport units and proportions */
.arc-task-runner-view {
    width: 85vw;
    /* Use 95% of viewport width */
    max-width: 1430px;
    /* Cap at original size for very large screens */
    min-width: 1000px;
    /* Minimum width to prevent breaking */
    margin: 0 auto;
    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial;
    font-weight: 300;
    font-size: 16px;
    background-color: #f8f9fa;
    min-height: auto;
    padding: 10px;
    box-sizing: border-box;
}

.info-bar {
    text-align: center;
    margin-top: 2px;
    margin-left: 10px;
    height: 40px;
    font-size: 18px;
    background-color: #ffffff;
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #dee2e6;
}

.content-wrapper {
    display: flex;
    gap: 1%;
    /* Proportional gap */
    flex-wrap: nowrap;
    align-items: flex-start;
    /* Align to top to prevent overlap */
}

.panel {
    background-color: #d5d5d5;
    border-radius: 10px;
    padding: 10px;
    margin: 5px;
    box-sizing: border-box;
}

.panel-title {
    text-align: center;
    background: white;
    padding: 5px;
    margin-bottom: 10px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 18px;
    margin-top: 0;
}

.panel-title.centered {
    text-align: center;
}

/* Proportional dimensions */
.examples-panel {
    width: 30%;
    /* 30% of container width */
    min-width: 350px;
    /* Minimum to prevent crushing */
    /* max-height: 800px; */
    overflow-y: auto;
    flex-shrink: 0;
    /* Don't shrink below min-width */
}

.evaluation-panel {
    width: 68%;
    /* 68% of container width */
    min-width: 600px;
    /* Minimum to prevent crushing */
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    /* Don't shrink below min-width */
}

.example-pair {
    padding: 10px;
    display: flex;
    gap: 30px;
    justify-content: space-between;
}

.grid-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 120px;
}

.grid-header {
    text-align: center;
    padding: 3px;
    margin-bottom: 3px;
    font-weight: bold;
}

.evaluation-grids-container {
    display: flex;
    gap: 2%;
    margin-bottom: 15px;
    justify-content: space-between;
}

.test-input-group,
.test-output-group {
    width: 48%;
    /* Each takes ~48% of evaluation panel */
    min-width: 250px;
    /* Minimum for readability */
    margin: 10px 0;
}

/* Controls styling with better spacing */
.controls-section {
    background: white;
    padding: 15px;
    border-radius: 6px;
    margin-top: 10px;
    box-sizing: border-box;
}

.controls-title {
    font-weight: bold;
    margin-bottom: 15px;
    font-size: 18px;
    margin-top: 0;
    text-align: center;
}

.control-row {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.control-label {
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 18px;
    text-align: center;
}

.tool-options {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
}

.tool-options button,
.action-buttons button,
.submit-button {
    font-size: 16px;
    /* Slightly smaller for better fit */
    padding: 6px 12px;
    margin: 2px;
    border: 1px solid transparent;
    border-radius: 8px;
    background-color: #0074d9;
    color: white;
    cursor: pointer;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
}

.tool-options button.active,
.tool-options button:hover,
.action-buttons button:hover {
    background-color: #004b8d;
    transform: translateY(1px);
}

.tool-options button.active {
    background-color: #004b8d;
}

/* Fixed color picker centering */
.color-picker {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin: 10px 0;
}

.color-picker .symbol-preview {
    width: 20px;
    height: 20px;
    border: 1px solid #ccc;
    cursor: pointer;
    border-radius: 2px;
    flex-shrink: 0;
}

.color-picker .symbol-preview.selected-symbol {
    border: 2px solid orange;
    box-shadow: 0 0 3px orange;
}

.grid-size-controls {
    text-align: center;
}

.grid-size-controls>div {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.grid-size-controls select {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #ced4da;
    font-size: 16px;
    min-width: 60px;
}

.action-buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    flex-direction: row;
}

.submit-section {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding-top: 15px;
    border-top: 1px solid #eee;
    margin-top: 15px;
    flex-direction: row;
}

.main-submit {
    background-color: rgb(28, 184, 65);
    color: white;
    font-weight: bold;
    font-size: 18px;
    padding: 8px 16px;
}

.main-submit:hover {
    background-color: rgb(0, 78, 0);
}

.debug-button {
    background-color: #6c757d;
    font-size: 14px;
    padding: 4px 8px;
}

/* Symbol colors */
.symbol-0 {
    background-color: #000000;
}

.symbol-1 {
    background-color: #0074D9;
}

.symbol-2 {
    background-color: #FF4136;
}

.symbol-3 {
    background-color: #2ECC40;
}

.symbol-4 {
    background-color: #FFDC00;
}

.symbol-5 {
    background-color: #AAAAAA;
}

.symbol-6 {
    background-color: #F012BE;
}

.symbol-7 {
    background-color: #FF851B;
}

.symbol-8 {
    background-color: #7FDBFF;
}

.symbol-9 {
    background-color: #870C25;
}

/* Description panel */
#write_solution_vue {
    background: white;
    padding: 15px;
    border-radius: 6px;
    box-sizing: border-box;
}

#write_solution_vue .panel-title {
    text-align: center;
    margin-bottom: 15px;
    font-size: 18px;
    font-weight: bold;
}

.description-prompt {
    font-style: italic;
    margin-bottom: 15px;
    text-align: center;
    line-height: 1.4;
}

#write_solution_vue textarea {
    width: 100%;
    min-height: 120px;
    padding: 10px;
    border: 2px solid #ccc;
    border-radius: 4px;
    background-color: #f8f8f8;
    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial;
    font-size: 16px;
    resize: vertical;
    margin-bottom: 15px;
    box-sizing: border-box;
}

/* #write_solution_vue .submit-button {
    display: block;
    width: 200px;
    margin: 0 auto;
    padding: 10px 20px;
    background-color: rgb(28, 184, 65);
    color: white;
    font-weight: bold;
    font-size: 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
} */

/* #write_solution_vue .submit-button:hover {
    background-color: rgb(22, 160, 56);
} */

/* Modal styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001;
}

.modal-content-viewer {
    background-color: white;
    border-radius: 8px;
    width: 90%;
    max-width: 700px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
}

.modal-header-viewer {
    padding: 2px 16px;
    background-color: #0074d9;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-modal-viewer {
    color: #aaa;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
}

.close-modal-viewer:hover {
    color: white;
}

.modal-body-viewer {
    padding: 2px 16px;
    line-height: 1.6;
}

/* Responsive behavior for smaller screens */
@media (max-width: 1200px) {
    .arc-task-runner-view {
        width: 98vw;
        min-width: 800px;
    }

    .examples-panel {
        width: 35%;
        min-width: 300px;
    }

    .evaluation-panel {
        width: 63%;
        min-width: 500px;
    }

    .evaluation-grids-container {
        flex-direction: column;
        align-items: center;
    }

    .test-input-group,
    .test-output-group {
        width: 80%;
        max-width: 400px;
    }
}

@media (max-width: 900px) {
    .content-wrapper {
        flex-direction: column;
    }

    .examples-panel,
    .evaluation-panel {
        width: 100%;
        min-width: auto;
    }

    .test-input-group,
    .test-output-group {
        width: 90%;
        max-width: 350px;
    }
}
</style>
