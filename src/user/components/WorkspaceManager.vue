<script setup>
import { defineProps, computed, ref, watch } from 'vue';
import EditableGrid from './EditableGrid.vue';

const props = defineProps({
    experimentApi: { // The whole return object from useArcExperiment
        type: Object,
        required: true,
    }
});

const localDescriptionText = ref("");

watch(() => props.experimentApi.isWritingSolution.value, (isWriting) => {
    if (isWriting) {
        localDescriptionText.value = props.experimentApi.isFirstWrittenDescriptionAttempt.value ?
            props.experimentApi.firstWrittenSolutionText.value :
            props.experimentApi.lastWrittenSolutionText.value;
    }
});

function submitDescription() {
    props.experimentApi.submitWrittenDescription(localDescriptionText.value);
    localDescriptionText.value = ""; // Clear after submit
}

function handleGridCellInteraction(payload) {
    props.experimentApi.handleCellInteraction(payload);
}

function handleGridSelectionChange(newSelection) {
    props.experimentApi.updateSelectedCells(newSelection);
}

const taskDemonstrationPairs = computed(() => {
    // This needs a reliable way to get train pairs from current task JSON.
    // Assuming experimentApi exposes currentTaskFullJson.train or similar.
    // For now, using the placeholder from composable.
    // return props.experimentApi.getExamplePairsForDisplay.value;

    // Let's assume currentTaskFullJson is available in experimentApi for this:
    if (props.experimentApi.currentTaskFullJson && props.experimentApi.currentTaskFullJson.value) {
        return props.experimentApi.currentTaskFullJson.value.train.map((pair, index) => ({
            id: `train_pair_${index}`,
            inputGrid: new props.experimentApi.Grid(pair.input.length, pair.input[0].length, pair.input),
            outputGrid: new props.experimentApi.Grid(pair.output.length, pair.output[0].length, pair.output),
        }));
    }
    return [];
});

const infoBarText = computed(() => {
    if (props.experimentApi.experimentPhase.value === 'tutorial_task') {
        return `Task: Tutorial Example | Attempt: ${props.experimentApi.currentTaskAttempt.value}`;
    }
    return `Task: ${props.experimentApi.currentTaskIndexGlobal.value + 1}/${props.experimentApi.taskList.value.length} (${props.experimentApi.currentTaskName.value}) | Attempt: ${props.experimentApi.currentTaskAttempt.value}/${props.experimentApi.MAX_ATTEMPTS_PER_TASK}`;
});

// --- Keyboard Shortcuts for Copy/Paste ---
function handleKeyDown(event) {
    if (props.experimentApi.isWritingSolution.value) return; // Don't interfere with typing

    if (event.key === 'c' || event.key === 'C') { // Copy
        // Check if focus is not in a text input field to avoid overriding browser copy.
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            event.preventDefault();
            props.experimentApi.copySelectedOutputCells();
        }
    }
    if (event.key === 'v' || event.key === 'V') { // Paste
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            event.preventDefault();
            props.experimentApi.pasteCopiedCells();
        }
    }
}
// Add/remove listener
import { onMounted, onUnmounted } from 'vue';
onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));

const descriptionPromptText = computed(() => {
    const phase = props.experimentApi.experimentPhase.value;
    const isSolved = props.experimentApi.isCurrentTaskSolved.value;
    const isFirstDesc = props.experimentApi.isFirstWrittenDescriptionAttempt.value;

    if (phase === 'tutorial_task') {
        if (isFirstDesc) return "Before we check your tutorial solution, please describe your approach. For this tutorial, please write: 'Create a checkerboard pattern by alternating between the two colors in each row.'";
        return "Congratulations, you solved the tutorial! Please write the final description: 'Create a checkerboard pattern by alternating between the two colors in each row.'";
    }
    // Experiment phase
    if (isFirstDesc) return "Please describe what you think the rule is to transform the input to the output for this task. When you are done, press Submit to continue.";
    if (isSolved) return "You correctly solved this task! Please describe your solution. Your description will be passed to another person.";
    return "Unfortunately, you made three unsuccessful attempts. Please describe what you thought the rule was.";
});


</script>

<template>
    <div id="workspace_vue">
        <!-- Task Demonstration Examples -->
        <div id="demonstration_examples_view_vue">
            <div class="text" id="task_demo_header_vue">Task Demonstration</div>
            <div id="task_preview_vue">
                <div v-for="(pair, index) in taskDemonstrationPairs" :key="pair.id" class="pair_preview_vue">
                    <div class="preview_block_vue">
                        <div class="subTextLeft">Example Input {{ index + 1 }}</div>
                        <EditableGrid :gridInstance="pair.inputGrid" :containerWidth="200" :containerHeight="200"
                            :maxCellSize="60" />
                    </div>
                    <div class="preview_block_vue output-preview-block">
                        <div class="subTextRight">Example Output {{ index + 1 }}</div>
                        <EditableGrid :gridInstance="pair.outputGrid" :containerWidth="200" :containerHeight="200"
                            :maxCellSize="60" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Evaluation View (Input, Output Editor) -->
        <div id="evaluation_view_vue">
            <div id="task_info_bar_vue">{{ infoBarText }}</div>

            <div class="evaluation-columns">
                <div id="evaluation_input_view_vue">
                    <div class="text">Test Input</div>
                    <EditableGrid :gridInstance="props.experimentApi.currentInputGrid.value"
                        :containerWidth="props.experimentApi.EDITION_GRID_CONTAINER_WIDTH"
                        :containerHeight="props.experimentApi.EDITION_GRID_CONTAINER_HEIGHT"
                        :maxCellSize="props.experimentApi.MAX_CELL_SIZE_CONFIG"
                        :allowSelect="props.experimentApi.selectedTool.value === 'select'"
                        :selectedCells="props.experimentApi.selectedCells.value"
                        @selection-change="handleGridSelectionChange" />
                    <!-- Add copy from input grid functionality if needed -->
                </div>

                <div id="evaluation_output_editor_vue">
                    <div class="text">Test Output</div>
                    <EditableGrid :gridInstance="props.experimentApi.currentOutputGrid.value" :isInteractive="true"
                        :containerWidth="props.experimentApi.EDITION_GRID_CONTAINER_WIDTH"
                        :containerHeight="props.experimentApi.EDITION_GRID_CONTAINER_HEIGHT"
                        :maxCellSize="props.experimentApi.MAX_CELL_SIZE_CONFIG"
                        :allowSelect="props.experimentApi.selectedTool.value === 'select'"
                        :selectedCells="props.experimentApi.selectedCells.value" @cell-click="handleGridCellInteraction"
                        @cell-mousedown="handleGridCellInteraction" @cell-mousemove="handleGridCellInteraction"
                        @cell-mouseup="handleGridCellInteraction" @selection-change="handleGridSelectionChange" />
                </div>
            </div>

            <!-- Solution Writing Area -->
            <div v-if="props.experimentApi.isWritingSolution.value" id="write_solution_vue">
                <p>{{ descriptionPromptText }}</p>
                <textarea v-model="localDescriptionText" rows="4"></textarea>
                <button @click="submitDescription">Submit Description</button>
            </div>

            <!-- Toolbar and Controls -->
            <div id="editor_controls_vue" v-show="!props.experimentApi.isWritingSolution.value">
                <div>
                    <label>Tool:</label>
                    <input type="radio" id="tool_edit_vue" value="edit"
                        v-model="props.experimentApi.selectedTool.value"> <label for="tool_edit_vue">Edit</label>
                    <input type="radio" id="tool_select_vue" value="select"
                        v-model="props.experimentApi.selectedTool.value"> <label for="tool_select_vue">Select</label>
                    <input type="radio" id="tool_floodfill_vue" value="floodfill"
                        v-model="props.experimentApi.selectedTool.value"> <label for="tool_floodfill_vue">Flood
                        Fill</label>
                </div>
                <div>
                    <label>Color:</label>
                    <span v-for="i in 10" :key="`color-${i - 1}`"
                        :class="['symbol_preview_vue', `symbol-${i - 1}`, { 'selected-symbol': props.experimentApi.selectedSymbol.value === i - 1 }]"
                        :style="{ backgroundColor: `var(--symbol-${i - 1}-bg)` }" <!-- CSS custom props for colors -->
                        @click="props.experimentApi.selectedSymbol.value = i-1; props.experimentApi.selectedTool.value
                        === 'select' && props.experimentApi.selectedCells.value.size > 0 ?
                        props.experimentApi.changeColorOfSelectedCells() : null">
                    </span>
                </div>
                <div>
                    <label>Output Height:</label>
                    <select v-model.number="props.experimentApi.outputGridHeight.value"
                        @change="props.experimentApi.updateOutputGridSize(props.experimentApi.outputGridHeight.value, props.experimentApi.outputGridWidth.value)">
                        <option v-for="h in 30" :key="h" :value="h">{{ h }}</option>
                    </select>
                    <label>Output Width:</label>
                    <select v-model.number="props.experimentApi.outputGridWidth.value"
                        @change="props.experimentApi.updateOutputGridSize(props.experimentApi.outputGridHeight.value, props.experimentApi.outputGridWidth.value)">
                        <option v-for="w in 30" :key="w" :value="w">{{ w }}</option>
                    </select>
                </div>
                <div>
                    <button @click="props.experimentApi.copyInputToOutput()">Copy Input</button>
                    <button @click="props.experimentApi.resetOutputGrid()">Reset Output</button>
                    <button @click="props.experimentApi.undoLastAction()">Undo</button>
                    <button v-if="props.experimentApi.selectedTool.value === 'select'"
                        @click="props.experimentApi.copySelectedOutputCells()">Copy Selection (C)</button>
                    <button v-if="props.experimentApi.selectedTool.value === 'select'"
                        @click="props.experimentApi.pasteCopiedCells()">Paste Selection (V)</button>
                </div>
                <button @click="props.experimentApi.submitSolutionAttempt()" id="submit_solution_btn_vue">Submit
                    Solution</button>
                <button @click="props.experimentApi.autoSolveCurrentTask()" title="For Testing">Auto-Solve</button>
                <!-- Optional Test Button -->
            </div>

        </div>
    </div>
</template>

<style scoped>
/* Define --symbol-X-bg custom properties in a global scope or here if not already */
:root {
    /* Or a more specific parent if not global */
    --symbol-0-bg: #000000;
    --symbol-1-bg: #0074D9;
    --symbol-2-bg: #FF4136;
    --symbol-3-bg: #2ECC40;
    --symbol-4-bg: #FFDC00;
    --symbol-5-bg: #AAAAAA;
    --symbol-6-bg: #F012BE;
    --symbol-7-bg: #FF851B;
    --symbol-8-bg: #7FDBFF;
    --symbol-9-bg: #870C25;
}

#workspace_vue {
    display: flex;
    gap: 20px;
    padding: 15px;
    font-size: 16px;
}

#demonstration_examples_view_vue {
    width: 430px;
    background-color: #f0f0f0;
    padding: 10px;
    border-radius: 5px;
    max-height: 80vh;
    overflow-y: auto;
}

#task_preview_vue {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.pair_preview_vue {
    display: flex;
    gap: 10px;
    /* Space between input and output preview */
    align-items: flex-start;
    padding-bottom: 10px;
    border-bottom: 1px solid #ddd;
}

.pair_preview_vue:last-child {
    border-bottom: none;
}

.preview_block_vue {
    width: 200px;
    /* Fixed width for preview blocks */
}

.output-preview-block {
    /* margin-left: 10px; */
    /* If extra spacing is needed */
}

.subTextLeft,
.subTextRight {
    text-align: center;
    font-weight: bold;
    margin-bottom: 5px;
    font-size: 0.9em;
}

#evaluation_view_vue {
    flex-grow: 1;
    background-color: #f0f0f0;
    padding: 10px;
    border-radius: 5px;
}

#task_info_bar_vue {
    text-align: center;
    padding: 8px;
    background-color: #e0e0e0;
    border-radius: 4px;
    margin-bottom: 10px;
    font-weight: bold;
}

.evaluation-columns {
    display: flex;
    gap: 15px;
    /* Space between input grid and output editor */
    margin-bottom: 15px;
}

#evaluation_input_view_vue,
#evaluation_output_editor_vue {
    flex: 1;
    /* Make them share space */
    min-width: 0;
    /* Important for flex items to shrink properly */
}

#evaluation_input_view_vue .text,
#evaluation_output_editor_vue .text {
    /* Headers for Test Input/Output */
    text-align: center;
    font-weight: bold;
    padding: 5px;
    background-color: #ddd;
    border-radius: 3px;
    margin-bottom: 8px;
}

#write_solution_vue {
    margin-top: 15px;
    padding: 10px;
    background-color: #e9e9e9;
    border-radius: 4px;
}

#write_solution_vue p {
    margin-bottom: 8px;
    font-style: italic;
}

#write_solution_vue textarea {
    width: 100%;
    min-height: 80px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    box-sizing: border-box;
    margin-bottom: 8px;
}

#editor_controls_vue {
    margin-top: 15px;
    padding: 10px;
    background-color: #e0e0e0;
    border-radius: 4px;
}

#editor_controls_vue>div {
    margin-bottom: 10px;
}

#editor_controls_vue label {
    margin-right: 5px;
    font-weight: bold;
}

#editor_controls_vue input[type="radio"],
#editor_controls_vue select {
    margin-right: 10px;
}

.symbol_preview_vue {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 1px solid #ccc;
    margin-right: 3px;
    cursor: pointer;
    vertical-align: middle;
}

.symbol_preview_vue.selected-symbol {
    border: 2px solid orange;
    box-shadow: 0 0 3px orange;
}

#editor_controls_vue button,
#write_solution_vue button {
    padding: 8px 12px;
    margin-right: 8px;
    margin-top: 5px;
    /* For buttons that wrap */
    background-color: #0074d9;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

#editor_controls_vue button:hover,
#write_solution_vue button:hover {
    background-color: #005ea6;
}

#submit_solution_btn_vue {
    background-color: #2ECC40;
    /* Green */
}

#submit_solution_btn_vue:hover {
    background-color: #27ab34;
}

/* Globalish styles that might have been in the original that affect layout or base elements */
.text {
    /* From original, if used as a generic header style */
    text-align: center;
    background: white;
    /* Or #ddd or similar if that's the theme */
    padding: 5px 0;
    margin-bottom: 10px;
    font-weight: bold;
    border-radius: 3px;
}
</style>
