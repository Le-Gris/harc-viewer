<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import useArcTaskLogic from '@/user/composables/useArcTaskLogic';
import EditableGrid from '@/user/components/EditableGrid.vue';
import useViewAPI from '@/core/composables/useViewAPI'; // For api.next()
import useSmileStore from "@/core/stores/smilestore";

const props = defineProps({
    taskFileName: {
        type: String,
        required: true,
    },
    isTutorialMode: {
        type: Boolean,
        default: false,
    },
    // Add any other props needed from design.js, like task sequence info
    taskNumber: Number,
    totalTasks: Number,
});

const viewApi = useViewAPI();
const smilestore = useSmileStore();

const taskLogic = useArcTaskLogic(props.taskFileName, props.isTutorialMode, smilestore, viewApi);

const localDescriptionModel = ref(""); // For the textarea

onMounted(() => {
    taskLogic.loadTask();
    taskLogic.onFinish(() => {
        // Task logic signals it's finished (solved/exhausted & description submitted)
        viewApi.next();
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
        `Task ${props.taskNumber || '-'}/${props.totalTasks || '-'} (${props.taskFileName})`;
    text += ` | Attempt: ${taskLogic.currentAttempt.value}/${taskLogic.MAX_ATTEMPTS}`;
    if (taskLogic.isSolved.value) text += " (Solved)";
    return text;
});

const descriptionPromptText = computed(() => {
    if (!taskLogic.isWritingDescription.value) return "";
    if (props.isTutorialMode) {
        // Simplified tutorial description prompt
        return "Please describe your solution for the tutorial task. Example: 'Create a checkerboard pattern.'";
    }
    if (taskLogic.isFirstDescriptionAttemptForTask.value) {
        return "Please describe what you think the rule is to transform the input to the output. Press 'Submit Description' to continue.";
    }
    if (taskLogic.isSolved.value) {
        return "Correct! Please describe your solution. This will be shown to another participant.";
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
            taskLogic.copyFromSelectedOutputCells();
        }
    }
    if ((event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey)) {
        if (taskLogic.selectedTool.value === 'select' && taskLogic.copiedCellData.value.cells.length > 0) {
            event.preventDefault();
            taskLogic.pasteToOutputCells();
        }
    }
}
import { onUnmounted } from 'vue'; // Import onUnmounted
onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));

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
                        <EditableGrid :gridInstance="pair.inputGrid" :containerWidth="180" :containerHeight="180"
                            :maxCellSize="50" />
                    </div>
                    <div class="grid-group">
                        <div class="grid-header">Example Output {{ index + 1 }}</div>
                        <EditableGrid :gridInstance="pair.outputGrid" :containerWidth="180" :containerHeight="180"
                            :maxCellSize="50" />
                    </div>
                </div>
            </div>

            <!-- Evaluation View (Input, Output Editor) -->
            <div id="evaluation_view_vue" class="panel evaluation-panel">
                <div class="evaluation-grids-container">
                    <div class="grid-group test-input-group">
                        <h3 class="panel-title centered">Test Input</h3>
                        <EditableGrid :gridInstance="taskLogic.currentInputGrid.value"
                            :containerWidth="taskLogic.EDITION_GRID_CONTAINER_WIDTH"
                            :containerHeight="taskLogic.EDITION_GRID_CONTAINER_HEIGHT"
                            :maxCellSize="taskLogic.MAX_CELL_SIZE_CONFIG" :isInteractive="false" />
                    </div>

                    <div class="grid-group test-output-group">
                        <h3 class="panel-title centered">Test Output</h3>
                        <EditableGrid :gridInstance="taskLogic.currentOutputGrid.value" :isInteractive="true"
                            :containerWidth="taskLogic.EDITION_GRID_CONTAINER_WIDTH"
                            :containerHeight="taskLogic.EDITION_GRID_CONTAINER_HEIGHT"
                            :maxCellSize="taskLogic.MAX_CELL_SIZE_CONFIG"
                            :allowSelect="taskLogic.selectedTool.value === 'select'"
                            :selectedCells="taskLogic.selectedCells.value" @cell-click="taskLogic.handleCellInteraction"
                            @cell-mousedown="taskLogic.handleCellInteraction"
                            @cell-mousemove="taskLogic.handleCellInteraction"
                            @cell-mouseup="taskLogic.handleCellInteraction"
                            @selection-change="taskLogic.updateSelectedCellsOnOutputGrid" />
                    </div>
                </div>
            </div>
            <!-- Toolbar and Controls -->
            <div id="editor_controls_vue" class="panel controls-panel" v-show="!taskLogic.isWritingDescription.value">
                <h3 class="panel-title">Controls</h3>
                <div class="control-section">
                    <label class="control-label">Tool:</label>
                    <div class="tool-options">
                        <button :class="{ active: taskLogic.selectedTool.value === 'edit' }"
                            @click="taskLogic.selectedTool.value = 'edit'">Edit</button>
                        <button :class="{ active: taskLogic.selectedTool.value === 'select' }"
                            @click="taskLogic.selectedTool.value = 'select'">Select</button>
                        <button :class="{ active: taskLogic.selectedTool.value === 'floodfill' }"
                            @click="taskLogic.selectedTool.value = 'floodfill'">Flood Fill</button>
                    </div>
                </div>
                <div class="control-section">
                    <label class="control-label">Color:</label>
                    <div class="color-picker">
                        <span v-for="i in 10" :key="`color-${i - 1}`"
                            :class="['symbol-preview', `symbol-${i - 1}`, { 'selected-symbol': taskLogic.selectedSymbol.value === i - 1 }]"
                            @click="taskLogic.selectedSymbol.value = i - 1; taskLogic.selectedTool.value === 'select' && taskLogic.selectedCells.value.size > 0 ? taskLogic.changeColorOfSelectedOutputCells() : null">
                        </span>
                    </div>
                </div>
                <div class="control-section grid-size-controls">
                    <label class="control-label">Output Grid Size:</label>
                    <div>
                        Height: <select v-model.number="taskLogic.outputGridHeight.value"
                            @change="taskLogic.updateOutputGridSize(taskLogic.outputGridHeight.value, taskLogic.outputGridWidth.value)">
                            <option v-for="h in 30" :key="h" :value="h">{{ h }}</option>
                        </select>
                        Width: <select v-model.number="taskLogic.outputGridWidth.value"
                            @change="taskLogic.updateOutputGridSize(taskLogic.outputGridHeight.value, taskLogic.outputGridWidth.value)">
                            <option v-for="w in 30" :key="w" :value="w">{{ w }}</option>
                        </select>
                    </div>
                </div>
                <div class="control-section action-buttons">
                    <button @click="taskLogic.copyInputToOutput()">Copy Input</button>
                    <button @click="taskLogic.resetOutputGrid()">Reset Output</button>
                    <button @click="taskLogic.undoLastAction()">Undo</button>
                    <button v-if="taskLogic.selectedTool.value === 'select'"
                        @click="taskLogic.copyFromSelectedOutputCells()" title="Or Ctrl/Cmd+C">Copy Sel.</button>
                    <button v-if="taskLogic.selectedTool.value === 'select'" @click="taskLogic.pasteToOutputCells()"
                        title="Or Ctrl/Cmd+V">Paste Sel.</button>
                </div>
                <div class="control-section submit-section">
                    <button @click="taskLogic.handleSubmitAttempt()" class="submit-button main-submit">Submit
                        Solution</button>
                    <button @click="taskLogic.autoSolve()" class="submit-button debug-button"
                        title="For Testing Only">Auto-Solve</button>
                </div>
            </div>
        </div>


        <!-- Solution Writing Area -->
        <div v-if="taskLogic.isWritingDescription.value" id="write_solution_vue" class="panel description-panel">
            <h3 class="panel-title">Describe Your Solution</h3>
            <p class="description-prompt">{{ descriptionPromptText }}</p>
            <textarea v-model="localDescriptionModel" rows="5" placeholder="Type your description here..."></textarea>
            <button @click="handleDescriptionSubmit" class="submit-button">Submit Description</button>
        </div>

        <!-- Help Button -->
        <button @click="toggleHelpModal" class="help-button-fixed">?</button>
        <!-- Help Modal (simplified, content needs to be filled from original) -->
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
/* --- General Layout & Panels --- */
.arc-task-runner-view {
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 15px;
    background-color: #f8f9fa;
    /* Light page background */
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    min-height: 95vh;
}

.info-bar {
    text-align: center;
    padding: 10px;
    background-color: #e9ecef;
    border-radius: 6px;
    font-weight: bold;
    margin-bottom: 10px;
    font-size: 1.1em;
}

.content-wrapper {
    display: flex;
    flex-wrap: wrap;
    /* Allow wrapping for smaller screens if controls go below */
    gap: 15px;
    flex-grow: 1;
}

.panel {
    background-color: #ffffff;
    /* White background for panels */
    border: 1px solid #dee2e6;
    /* Light border for panels */
    border-radius: 6px;
    padding: 15px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.panel-title {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2em;
    color: #343a40;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}

.panel-title.centered {
    text-align: center;
}


.examples-panel {
    width: 400px;
    /* Fixed width for example pairs */
    max-height: calc(85vh - 60px);
    /* Adjust based on info-bar height */
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.example-pair {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f0f0f0;
}

.example-pair:last-child {
    border-bottom: none;
}

.evaluation-panel {
    flex-grow: 1;
    /* Takes remaining space */
    display: flex;
    flex-direction: column;
    /* Stack grids above controls */
}

.evaluation-grids-container {
    display: flex;
    gap: 15px;
    margin-bottom: 15px;
    /* Space before controls if they were below */
}


.grid-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Center the grid component if it's smaller */
}

.test-input-group,
.test-output-group {
    flex: 1;
    /* Share space equally */
    min-width: 0;
    /* Allow shrinking */
}

.grid-header {
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 0.95em;
    color: #495057;
}


.controls-panel {
    width: 100%;
    /* Full width if it wraps */
    /* Or fixed width if always sidebar: width: 300px; */
    max-height: calc(85vh - 60px);
    overflow-y: auto;
    order: 3;
    /* Default order if in main flow */
}

/* If controls are a sidebar next to evaluation panel: */
/* .content-wrapper { flex-wrap: nowrap; } */
/* .evaluation-panel { width: auto; } /* Let it take space */
/* .controls-panel { width: 280px; flex-shrink: 0; order: 2; margin-left:15px} */
/* .examples-panel { order: 1;} */
/* .description-panel { order: 4; width: 100%;} */

.control-section {
    margin-bottom: 20px;
}

.control-label {
    display: block;
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 1em;
}

.tool-options button,
.action-buttons button,
.submit-button {
    padding: 8px 12px;
    margin-right: 8px;
    margin-bottom: 8px;
    /* For wrapping */
    border: 1px solid #ced4da;
    border-radius: 4px;
    background-color: #f8f9fa;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
}

.tool-options button.active,
.tool-options button:hover,
.action-buttons button:hover,
.submit-button:hover {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
}

.tool-options button.active {
    background-color: #0056b3;
    border-color: #0056b3;
    color: white;
}


.color-picker .symbol-preview {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 1px solid #ccc;
    margin-right: 4px;
    margin-bottom: 4px;
    cursor: pointer;
    vertical-align: middle;
    border-radius: 3px;
}

.color-picker .symbol-preview.selected-symbol {
    border: 2px solid orange;
    box-shadow: 0 0 5px orange;
}

/* Symbol colors - defined in EditableGrid.vue, but a fallback or direct style might be needed if :style binding is not used */
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


.grid-size-controls select {
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #ced4da;
    margin-left: 5px;
    margin-right: 15px;
}

.submit-section {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #eee;
}

.main-submit {
    background-color: #28a745;
    border-color: #28a745;
    color: white;
    font-weight: bold;
}

.main-submit:hover {
    background-color: #218838;
    border-color: #1e7e34;
}

.debug-button {
    font-size: 0.8em;
    padding: 5px 8px;
    background-color: #6c757d;
    border-color: #6c757d;
    color: white;
}

.debug-button:hover {
    background-color: #5a6268;
}


.description-panel {
    margin-top: 15px;
    /* Or handled by gap */
    width: 100%;
    /* Take full width if it's separate */
}

.description-prompt {
    font-style: italic;
    color: #495057;
    margin-bottom: 10px;
}

.description-panel textarea {
    width: 100%;
    min-height: 100px;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 10px;
    font-size: 1em;
}

.description-panel .submit-button {
    background-color: #007bff;
    color: white;
}

.description-panel .submit-button:hover {
    background-color: #0056b3;
}


/* --- Help Modal --- (using -viewer suffix to avoid collision if old styles persist) */
.help-button-fixed {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #007bff;
    color: white;
    border: none;
    font-size: 1.5em;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
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
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
}

.modal-header-viewer {
    padding: 15px 20px;
    background-color: #007bff;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}

.modal-header-viewer h3 {
    margin: 0;
    font-size: 1.3em;
}

.close-modal-viewer {
    font-size: 1.8em;
    cursor: pointer;
    line-height: 1;
}

.modal-body-viewer {
    padding: 20px;
    line-height: 1.6;
    color: #333;
}

.modal-body-viewer h4 {
    margin-top: 15px;
    margin-bottom: 8px;
}

.modal-body-viewer ul {
    padding-left: 20px;
    margin-bottom: 10px;
}

.modal-body-viewer li {
    margin-bottom: 5px;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 1200px) {

    /* Adjust breakpoint as needed */
    .content-wrapper {
        flex-direction: column;
        /* Stack panels vertically */
    }

    .examples-panel,
    .evaluation-panel,
    .controls-panel {
        width: 100%;
        /* Full width for stacked panels */
        max-height: none;
        /* Allow full height when stacked */
    }

    .evaluation-grids-container {
        flex-direction: column;
        /* Stack test input/output vertically */
        align-items: center;
        /* Center them when stacked */
    }

    .test-input-group,
    .test-output-group {
        width: 100%;
        /* Full width for stacked grids */
        max-width: 500px;
        /* Limit max width if desired */
    }
}
</style>
