<script setup>
import { ref, computed } from 'vue';
import useViewAPI from '@/core/composables/useViewAPI';

const api = useViewAPI();

const currentSlideIndex = ref(0);
const slides = [
    { title: "ARC Tutorial (1/12)", content: "In this experiment, you will complete a number of different tasks involving a series of colored rectangular grids...", image1: api.getPublicUrl("example-input-one-eval.png"), image2: api.getPublicUrl("example-output-one-eval.png"), computerArrow: true },
    { title: "ARC Tutorial (2/12)", content: "For each task, you will be provided with a new Test Input, and your goal is to guess what the correct Test Output should be...", image1: api.getPublicUrl("test-input-eval.png"), image2: api.getPublicUrl("blank-grid-eval.png"), computerArrow: true },
    { title: "ARC Tutorial (3/12)", content: "For this example, the particular rule is to create a checkerboard pattern...", image1: api.getPublicUrl("test-input-eval.png"), image2: api.getPublicUrl("test-output-eval.png"), computerArrow: true },
    { title: "ARC Tutorial (4/12)", content: "Below is an image of the interface that you will be using...", imageWide: api.getPublicUrl("arc-interface-eval.png") },
    { title: "ARC Tutorial (5/12)", content: "Changing the Grid Size and Copy from Input...", video: api.getPublicUrl("resize-and-copy-from-input-eval.mp4") },
    { title: "ARC Tutorial (6/12)", content: "Using the Edit Tool...", video: api.getPublicUrl("edit-tool-eval.mp4") },
    { title: "ARC Tutorial (7/12)", content: "Using the Select Tool to change color...", video: api.getPublicUrl("select-change-color-eval.mp4") },
    { title: "ARC Tutorial (8/12)", content: "Using the Select Tool to Copy and Paste...", video: api.getPublicUrl("select-copy-paste-eval.mp4") },
    { title: "ARC Tutorial (9/12)", content: "Using the Flood Fill Tool...", video: api.getPublicUrl("flood-fill-eval.mp4") },
    { title: "ARC Tutorial (10/12)", content: "Using the Undo button...", video: api.getPublicUrl("undo-eval.mp4") },
    { title: "ARC Tutorial (11/12)", content: "Submitting your solution. You will have three attempts for each task...", video: api.getPublicUrl("submit-eval.mp4") },
    { title: "ARC Tutorial (12/12)", content: "WARNING! If you refresh the experiment, you will be taken back to the beginning..." }
];

const currentSlide = computed(() => slides[currentSlideIndex.value]);

function next() {
    if (currentSlideIndex.value < slides.length - 1) {
        currentSlideIndex.value++;
    } else {
        api.goNextView(); // Go to the next view in the timeline (e.g., Tutorial Task)
    }
}
function prev() {
    if (currentSlideIndex.value > 0) {
        currentSlideIndex.value--;
    }
    // else: stay on first slide, or could go to a prev view in timeline if configured
}
function goToSlide(index) {
    currentSlideIndex.value = index;
}
</script>

<template>
    <div class="tutorial-slides-view">
        <div class="slide-content">
            <h3>{{ currentSlide.title }}</h3>
            <p v-html="currentSlide.content"></p>

            <div v-if="currentSlide.image1 && currentSlide.image2" class="tutorial-image-pair">
                <img :src="currentSlide.image1" alt="Example Input">
                <div v-if="currentSlide.computerArrow" class="computer-arrow-graphic">
                    <img :src="api.getPublicUrl('comp-eval.svg')" alt="Computer" class="comp-graphic">
                    <img :src="api.getPublicUrl('arrow-eval.svg')" alt="Arrow" class="arrow-graphic">
                </div>
                <span v-else class="arrow-text">&rarr;</span>
                <img :src="currentSlide.image2" alt="Example Output">
            </div>
            <img v-if="currentSlide.imageWide" :src="currentSlide.imageWide" alt="Interface Overview"
                class="wide-image">
            <video v-if="currentSlide.video" :src="currentSlide.video" controls autoplay muted loop playsinline
                class="tutorial-video"></video>
        </div>
        <div class="slide-navigation">
            <button @click="prev" :disabled="currentSlideIndex === 0">Previous</button>
            <div class="dots-container">
                <span v-for="(slide, index) in slides" :key="index" class="dot"
                    :class="{ active: currentSlideIndex === index }" @click="goToSlide(index)">
                </span>
            </div>
            <button @click="next">
                {{ currentSlideIndex === slides.length - 1 ? 'Start Tutorial Task' : 'Next' }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.tutorial-slides-view {
    max-width: 900px;
    margin: 20px auto;
    padding: 20px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.slide-content h3 {
    text-align: center;
    margin-bottom: 15px;
    color: #333;
}

.slide-content p {
    line-height: 1.6;
    margin-bottom: 20px;
    text-align: justify;
}

.tutorial-image-pair {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    margin: 20px 0;
}

.tutorial-image-pair img {
    max-width: 250px;
    /* Adjust as needed */
    height: auto;
    border: 1px solid #eee;
}

.computer-arrow-graphic {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 10px;
}

.comp-graphic {
    width: 80px;
}

.arrow-graphic {
    width: 40px;
    margin-top: 5px;
}

.arrow-text {
    font-size: 2em;
    margin: 0 10px;
}

.wide-image {
    display: block;
    max-width: 100%;
    margin: 15px auto;
    border: 1px solid #eee;
}

.tutorial-video {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 15px auto;
    border: 1px solid #eee;
    border-radius: 4px;
}

.slide-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 25px;
    padding-top: 15px;
    border-top: 1px solid #eee;
}

.slide-navigation button {
    padding: 10px 18px;
    border: 1px solid #007bff;
    background-color: #007bff;
    color: white;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
}

.slide-navigation button:disabled {
    background-color: #ccc;
    border-color: #ccc;
    cursor: not-allowed;
}

.dots-container {
    display: flex;
}

.dot {
    height: 12px;
    width: 12px;
    background-color: #bbb;
    border-radius: 50%;
    margin: 0 4px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.dot.active,
.dot:hover {
    background-color: #717171;
}
</style>
