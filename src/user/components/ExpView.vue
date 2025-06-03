<script setup>
import { onMounted, onBeforeUnmount, computed } from 'vue';
import useArcExperiment from '@/user/composables/useArcExperiment';
import useViewAPI from '@/core/composables/useViewAPI';
import useSmileStore from "@/core/stores/smilestore";

import TutorialManager from './TutorialManager.vue';
import WorkspaceManager from './WorkspaceManager.vue';
// Import uiUtils if needed directly here, or rely on composable using them
// import { errorMsg, infoMsg } from '@/user/utils/uiUtils';


const api = useViewAPI();
const smilestore = useSmileStore();

const experimentApi = useArcExperiment(api, smilestore);

onMounted(() => {
    experimentApi.initExperiment();
});

onBeforeUnmount(() => {
    experimentApi.cleanupExperiment();
});

const showTutorial = computed(() =>
    experimentApi.experimentPhase.value === 'tutorial_slides' ||
    experimentApi.experimentPhase.value === 'tutorial_quiz'
);

const showWorkspace = computed(() =>
    experimentApi.experimentPhase.value === 'tutorial_task' ||
    experimentApi.experimentPhase.value === 'experiment'
);

const showFinishedScreen = computed(() => experimentApi.experimentPhase.value === 'finished');

const localFeedbackText = ref(""); // For the final feedback box

function submitFinalFeedback() {
    experimentApi.submitFeedbackAndExit(localFeedbackText.value);
}

// Help Modal Logic (Simplified)
import { ref } from 'vue';
const showHelp = ref(false);
function toggleHelpModal() {
    showHelp.value = !showHelp.value;
    if (showHelp.value) {
        // experimentApi._logAction('show_help_modal'); // If _logAction is exposed or use a dedicated method
    }
}

</script>

<template>
    <div class="page-exp-view">
        <div v-if="experimentApi.experimentPhase.value === 'loading'" class="loading-screen">
            Loading Experiment...
        </div>

        <TutorialManager v-if="showTutorial" :experimentApi="experimentApi" />

        <WorkspaceManager v-if="showWorkspace" :experimentApi="experimentApi" />

        <div v-if="showFinishedScreen" id="experiment_finish_vue">
            <div class="finish-text">
                <h3>Congratulations, you have completed the experiment!</h3>
                <p>Please provide some feedback in the box below. We are especially interested in the strategies you
                    used to solve these problems. Click the <strong>Submit</strong> button to finish and submit your
                    results.</p>
                <form @submit.prevent="submitFinalFeedback">
                    <textarea v-model="localFeedbackText" rows="5" placeholder="Your feedback..."></textarea>
                    <button type="submit">Submit Feedback & Finish</button>
                </form>
            </div>
        </div>

        <!-- Help Button and Modal -->
        <button @click="toggleHelpModal" class="help-button">Help</button>
        <div v-if="showHelp" class="help-modal-overlay" @click.self="toggleHelpModal">
            <div class="help-modal-content">
                <div class="modal-header">
                    <h3>Help</h3>
                    <span class="close-modal" @click="toggleHelpModal">&times;</span>
                </div>
                <div class="modal-body">
                    <p>In this experiment, we are looking at your ability to solve abstract reasoning puzzles...</p>
                    <!-- ... All other help text from original modal ... -->
                    <p>Finally, if you think you have the correct output, press the <strong>Submit Solution</strong>
                        button!</p>
                </div>
            </div>
        </div>

        <!-- Global Notification Area (if using uiUtils' simple notifications) -->
        <!-- This might be better handled by a dedicated Vue notification component -->

    </div>
</template>

<style>
/* Keep truly global styles here or in a main CSS file */
body {
    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial;
    font-weight: 300;
    font-size: 16px;
    /* Base size, components can adjust */
    min-width: 1000px;
    /* Or responsive */
    margin: 0;
    background-color: #f4f4f4;
    /* Light background for the page */
}

.page-exp-view {
    padding: 10px;
    /* Add some padding around the main content */
}

.loading-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 24px;
    color: #555;
}

#experiment_finish_vue {
    max-width: 700px;
    margin: 40px auto;
    padding: 25px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    text-align: center;
}

#experiment_finish_vue h3 {
    margin-bottom: 15px;
    color: #333;
}

#experiment_finish_vue p {
    margin-bottom: 20px;
    line-height: 1.6;
    color: #555;
}

#experiment_finish_vue textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 15px;
    min-height: 100px;
}

#experiment_finish_vue button {
    padding: 10px 20px;
    background-color: #2ECC40;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}

#experiment_finish_vue button:hover {
    background-color: #27ab34;
}

/* Help Modal Styles */
.help-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 15px;
    background-color: #0074d9;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    z-index: 1000;
}

.help-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001;
}

.help-modal-content {
    background-color: white;
    padding: 0;
    /* Header/body will have padding */
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.modal-header {
    padding: 10px 20px;
    background-color: #0074d9;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}

.modal-header h3 {
    margin: 0;
}

.close-modal {
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
}

.modal-body {
    padding: 20px;
    line-height: 1.6;
}

.modal-body h3 {
    margin-top: 0;
}

.modal-body ul {
    padding-left: 20px;
}

.modal-body li {
    margin-bottom: 10px;
}

/* Add other necessary global styles that were present in the original ExpView.vue's <style> tag but are not component-specific */
</style>
