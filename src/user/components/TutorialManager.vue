<script setup>
import { ref, computed, defineProps, defineEmits, onMounted } from 'vue';
import EditableGrid from './EditableGrid.vue'; // If tutorial shows grids

const props = defineProps({
    experimentApi: { // The whole return object from useArcExperiment
        type: Object,
        required: true,
    }
});

const emit = defineEmits(['tutorial-slides-finished', 'tutorial-task-started', 'quiz-finished-correctly']);

const currentSlideIndex = ref(0);
const totalSlides = 12; // Based on original HTML

const quizAnswers = ref({
    q1_timed: 'yes', // Are any of the tasks timed?
    q2_attempts: '1', // How many attempts
    q3_total_tasks: '1', // How many tasks
    q4_bonus_sample: '1' // Bonus sample
});

const showSlide = (index) => {
    if (index >= 0 && index < totalSlides) {
        currentSlideIndex.value = index;
    } else if (index >= totalSlides) {
        // Finished slides, move to tutorial task
        props.experimentApi.startTutorialTask();
        emit('tutorial-slides-finished'); // Notify parent
    }
};

const nextSlide = () => showSlide(currentSlideIndex.value + 1);
const prevSlide = () => showSlide(currentSlideIndex.value - 1);

function handleSubmitQuiz() {
    // Pass answers to the composable
    props.experimentApi.submitTutorialQuiz({
        q1: quizAnswers.value.q1_timed,
        q2: quizAnswers.value.q2_attempts,
        q3: quizAnswers.value.q3_total_tasks,
        q4: quizAnswers.value.q4_bonus_sample,
    });
    // The composable will change experimentPhase if correct
}

// Display logic based on experimentApi.experimentPhase
const isShowingSlides = computed(() => props.experimentApi.experimentPhase.value === 'tutorial_slides');
const isShowingQuiz = computed(() => props.experimentApi.experimentPhase.value === 'tutorial_quiz');

onMounted(() => {
    if (isShowingSlides.value) {
        showSlide(0); // Start at first slide
    }
});

</script>

<template>
    <div class="tutorial-manager">
        <!-- Tutorial Slides -->
        <div v-if="isShowingSlides" id="tutorial_container_vue">
            <!-- Slide 1 -->
            <div v-show="currentSlideIndex === 0" class="tutorial_slide_vue">
                <div><strong>ARC Tutorial</strong> (1/{{ totalSlides }})<br /><br /></div>
                <div>In this experiment... (Content from original slide 1) <br /></div>
                <div class="tutorial_pair">
                    <img src="/example-input-one-eval.png" width="200" />
                    <img src="/example-output-one-eval.png" width="200" />
                </div>
            </div>
            <!-- Slide 2 -->
            <div v-show="currentSlideIndex === 1" class="tutorial_slide_vue">
                <div><strong>ARC Tutorial</strong> (2/{{ totalSlides }})<br /><br /></div>
                <div>For each task, you will be provided... (Content from original slide 2)<br /></div>
            </div>
            <!-- ... Add all 12 slides similarly, using v-show="currentSlideIndex === N" ... -->
            <div v-show="currentSlideIndex === 11" class="tutorial_slide_vue">
                <div><strong>ARC Tutorial</strong> (12/{{ totalSlides }})<br /><br /></div>
                <div>
                    <p><strong>WARNING!</strong></p>If you refresh the experiment...
                </div>
            </div>


            <div class="tutorial-navigation">
                <button @click="prevSlide" :disabled="currentSlideIndex === 0">&#10094; Previous</button>
                <span v-for="i in totalSlides" :key="i" @click="showSlide(i - 1)" class="dot"
                    :class="{ active: currentSlideIndex === i - 1 }">
                </span>
                <button @click="nextSlide">{{ currentSlideIndex === totalSlides - 1 ? 'Start Tutorial Task' : 'Next
                    &#10095; ' }}</button>
            </div>
        </div>

        <!-- Tutorial Quiz -->
        <div v-if="isShowingQuiz" id="tutorial_quiz_vue">
            <div class="tutorial_text">
                <div><strong>Before you begin... check your understanding.</strong></div>
            </div>

            <div class="tutorial_text">
                <div><strong>Are any of the tasks timed?</strong></div><br />
                <form>
                    <div>
                        <input type="radio" id="q1_yes" name="q1_timed" value="yes" v-model="quizAnswers.q1_timed" />
                        <label for="q1_yes">Yes</label>
                        <input type="radio" id="q1_no" name="q1_timed" value="no" v-model="quizAnswers.q1_timed" />
                        <label for="q1_no">No</label>
                    </div>
                </form>
            </div>

            <div class="tutorial_text">
                <div><strong>How many attempts do you have...?</strong></div><br />
                <select id="q2_attempts_vue" v-model="quizAnswers.q2_attempts">
                    <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
                </select>
            </div>

            <div class="tutorial_text">
                <div><strong>How many tasks in total are there?</strong></div><br />
                <select id="q3_total_tasks_vue" v-model="quizAnswers.q3_total_tasks">
                    <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
                </select>
            </div>

            <div class="tutorial_text">
                <div><strong>How many tasks will we randomly sample for a bonus?</strong></div><br />
                <select id="q4_bonus_sample_vue" v-model="quizAnswers.q4_bonus_sample">
                    <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
                </select>
            </div>

            <div class="tutorial_text">
                <button @click="handleSubmitQuiz" id="tutorial_quiz_btn_vue">Submit Quiz</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Add scoped styles from the original CSS that are relevant to tutorial slides and quiz */
/* For example: */
.tutorial_manager {
    /* Base container for this component */
    width: 100%;
    max-width: 900px;
    /* Consistent width for tutorial content */
    margin: 20px auto;
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.tutorial_slide_vue {
    margin-bottom: 20px;
    padding: 15px;
    border: 1px solid #eee;
    border-radius: 5px;
}

.tutorial_pair img {
    margin: 5px;
}

.tutorial-navigation {
    text-align: center;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #eee;
}

.tutorial-navigation button {
    margin: 0 10px;
    padding: 8px 15px;
    background-color: #0074d9;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.tutorial-navigation button:disabled {
    background-color: #ccc;
}

.dot {
    cursor: pointer;
    height: 12px;
    width: 12px;
    margin: 0 3px;
    background-color: #bbb;
    border-radius: 50%;
    display: inline-block;
    transition: background-color 0.3s ease;
}

.dot.active,
.dot:hover {
    background-color: #717171;
}

#tutorial_quiz_vue {
    margin-top: 30px;
}

.tutorial_text {
    margin-bottom: 25px;
    text-align: left;
    /* Or center, depending on desired look */
}

.tutorial_text strong {
    display: block;
    margin-bottom: 8px;
}

.tutorial_text input[type="radio"],
.tutorial_text select {
    margin-right: 5px;
}

.tutorial_text label {
    margin-right: 15px;
}

#tutorial_quiz_btn_vue {
    padding: 10px 20px;
    background-color: #2ECC40;
    /* Green */
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}

#tutorial_quiz_btn_vue:hover {
    background-color: #27ab34;
}

/* Styles for images, videos if any were in original tutorial slides */
.tutorial_video video,
.tutorial_pair img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px auto;
    /* Center images/videos */
}
</style>
