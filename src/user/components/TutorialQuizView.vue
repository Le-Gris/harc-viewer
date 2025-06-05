<script setup>
import { ref } from 'vue';
import useViewAPI from '@/core/composables/useViewAPI';
import { errorMsg, successMsg } from '@/user/utils/uiUtils.js';
import { EXPERIMENT_CONFIG } from '../utils/arcConstants';

const api = useViewAPI();

const quizAnswers = ref({
    q1_timed: 'yes',
    q2_attempts: '1',
    q3_total_tasks: '1',
    q4_bonus_sample: '1',
});

function handleSubmitQuiz() {
    const correct_q1 = quizAnswers.value.q1_timed === 'no'; // Tasks are not timed
    const correct_q2 = parseInt(quizAnswers.value.q2_attempts) === EXPERIMENT_CONFIG.MAX_ATTEMPTS_PER_TASK;
    const correct_q3 = parseInt(quizAnswers.value.q3_total_tasks) === EXPERIMENT_CONFIG.MAX_TASKS_PER_EXPERIMENT;
    const correct_q4 = parseInt(quizAnswers.value.q4_bonus_sample) === 1; // 1 bonus sample

    if (correct_q1 && correct_q2 && correct_q3 && correct_q4) {
        successMsg("Quiz completed correctly! Starting the main experiment.");
        api.goNextView(); // Proceed to the next view in the timeline
    } else {
        errorMsg("One or more quiz answers were incorrect. Please review and try again.");
    }
}
</script>

<template>
    <div class="tutorial-quiz-view">
        <h2>Tutorial Comprehension Check</h2>
        <p><strong>Before you begin the main experiment, we have a few more questions to
                check your understanding of the task. You will need to answer them all
                correctly in order to continue.</strong></p>

        <div class="quiz-question">
            <label>Are any of the tasks timed?</label>
            <div>
                <input type="radio" id="q1_yes_vue" value="yes" v-model="quizAnswers.q1_timed"> <label
                    for="q1_yes_vue">Yes</label>
                <input type="radio" id="q1_no_vue" value="no" v-model="quizAnswers.q1_timed"> <label
                    for="q1_no_vue">No</label>
            </div>
        </div>

        <div class="quiz-question">
            <label for="q2_attempts_vue">How many attempts do you have before you will be moved onto the next
                task?</label>
            <select id="q2_attempts_vue" v-model="quizAnswers.q2_attempts">
                <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
            </select>
        </div>

        <div class="quiz-question">
            <label for="q3_total_tasks_vue">How many tasks in total are there in the main experiment (excluding
                tutorial)?</label>
            <select id="q3_total_tasks_vue" v-model="quizAnswers.q3_total_tasks">
                <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
            </select>
        </div>

        <div class="quiz-question">
            <label for="q4_bonus_sample_vue"><strong>Finally, we will randomly sample one of your tasks to check for
                    accuracy
                    and description quality. You will be awarded a one dollar bonus if it is
                    answered correctly within three attempts and the description is of the
                    quality outlined in the tutorial. How many tasks will be randomly sampled to check for a
                    performance
                    bonus?</strong></label>
            <select id="q4_bonus_sample_vue" v-model="quizAnswers.q4_bonus_sample">
                <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
            </select>
        </div>

        <button @click="handleSubmitQuiz" class="button is-success">Submit Quiz</button>
    </div>
</template>

<style scoped>
.tutorial-quiz-view {
    max-width: 700px;
    margin: 30px auto;
    padding: 25px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.tutorial-quiz-view h2 {
    text-align: center;
    margin-bottom: 10px;
    color: #333;
}

.tutorial-quiz-view>p {
    text-align: center;
    margin-bottom: 25px;
    color: #555;
}

.quiz-question {
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border: 1px solid #eee;
    border-radius: 5px;
}

.quiz-question>label {
    display: block;
    font-weight: bold;
    margin-bottom: 8px;
    color: #495057;
}

.quiz-question>div {
    display: flex;
    align-items: center;
    gap: 15px;
    justify-content: center;
}

.quiz-question>div label {
    display: flex;
    align-items: center;
    font-weight: normal;
    margin: 0;
}

.quiz-question input[type="radio"] {
    margin: 0 5px 0 0;
}

.quiz-question select {
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid #ced4da;
    min-width: 60px;
}
</style>
