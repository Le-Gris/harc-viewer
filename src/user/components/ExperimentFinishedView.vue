<script setup>
import { ref } from 'vue';
import useViewAPI from '@/core/composables/useViewAPI';
import useSmileStore from '@/core/stores/smilestore';

const api = useViewAPI();
const smilestore = useSmileStore();
const feedbackText = ref("");

function submitFeedback() {
    // Save feedback to smilestore
    smilestore.recordProperty('experiment_feedback', feedbackText.value);
    smilestore.saveData();

    api.goNextView(); // Or a specific "finish" call if Smile has one
    // This will take to the 'thanks' page in design.js
}
</script>

<template>
    <div class="experiment-finished-view">
        <h2>Experiment Completed!</h2>
        <p>
            Congratulations, you have completed all tasks in the experiment!
            Please provide some feedback in the box below. We are especially interested in the strategies
            you used to solve these problems.
        </p>
        <form @submit.prevent="submitFeedback">
            <textarea v-model="feedbackText" rows="6"
                placeholder="Your feedback, thoughts, or strategies..."></textarea>
            <button type="submit">Submit Feedback and Finish</button>
        </form>
    </div>
</template>

<style scoped>
.experiment-finished-view {
    max-width: 700px;
    margin: 40px auto;
    padding: 30px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.experiment-finished-view h2 {
    color: #28a745;
    margin-bottom: 15px;
}

.experiment-finished-view p {
    line-height: 1.6;
    color: #555;
    margin-bottom: 20px;
}

.experiment-finished-view textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-sizing: border-box;
    margin-bottom: 20px;
    font-size: 1em;
}

.experiment-finished-view button {
    padding: 12px 25px;
    font-size: 1.1em;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

.experiment-finished-view button:hover {
    background-color: #0056b3;
}
</style>
