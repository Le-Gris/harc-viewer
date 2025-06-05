<script setup>
import { ref, computed } from 'vue';
import useViewAPI from '@/core/composables/useViewAPI';

const api = useViewAPI();

const currentSlideIndex = ref(0);
const slides = [
    {
        title: "ARC Tutorial (1/12)",
        content: "In this experiment, you will complete a number of different tasks involving a series of colored rectangular grids. In each task, you will be presented with a limited number of <strong>example input and output pairs</strong>, like the ones shown below. Each input is transformed by a machine that applies a <strong>hidden rule</strong> to produce a corresponding output.",
        image1: api.getPublicUrl("example-input-one-eval.png"),
        image2: api.getPublicUrl("example-output-one-eval.png"),
        computerArrow: true
    },
    {
        title: "ARC Tutorial (2/12)",
        content: "For each task, you will be provided with a new <strong>Test Input</strong>, and your goal in this experiment is to guess what the correct <strong>Test Output</strong> should be, based on the examples shown and what you think the hidden rule for that given task is.",
        image1: api.getPublicUrl("test-input-eval.png"),
        image2: api.getPublicUrl("blank-grid-eval.png"),
        computerArrow: true
    },
    {
        title: "ARC Tutorial (3/12)",
        content: "For this example, the particular rule is to create a checkerboard pattern by alternating between the two colors in each row, starting with the first color of each row as seen in the input grid. The rule will change from task to task, so you will need to look at the examples to discover the rule for each task.",
        image1: api.getPublicUrl("test-input-eval.png"),
        image2: api.getPublicUrl("test-output-eval.png"),
        computerArrow: true
    },
    {
        title: "ARC Tutorial (4/12)",
        content: "Below is an image of the interface that you will be using to solve these tasks. The example pairs will be shown on the left, the Test Input in the middle and the current Test Ouptut on the right. The set of tools to manipulate the Test Output are on the bottom right, and we will go through these tools one by one, and show you how to produce the Test Output for this example task.",
        imageWide: api.getPublicUrl("arc-interface-eval.png")
    },
    {
        title: "ARC Tutorial (5/12)",
        content: "In the clip below, we demonstrate <strong>changing the Grid Size</strong> of the Test Output from 3x3 to 2x6, followed by the <strong>Copy from Input</strong> button, which copies the test input to the test output (and automatically resizes the grid). Additionally, if you want to start over, you can always press the <strong>Reset Grid</strong> button to reset to a blank 3x3 grid.",
        video: api.getPublicUrl("resize-and-copy-from-input-eval.mp4")
    },
    {
        title: "ARC Tutorial (6/12)",
        content: "In the clip below, we show how to use the <strong>Edit Tool</strong> to modify the test output grid one square at a time. You can change colors by clicking on one of the ten different colors under the <strong>Select Color</strong> section.",
        video: api.getPublicUrl("edit-tool-eval.mp4")
    },
    {
        title: "ARC Tutorial (7/12)",
        content: "In the clip below, we show how to use the <strong>Select Tool</strong> to first select multiple cells by clicking and dragging, and then changing their color.",
        video: api.getPublicUrl("select-change-color-eval.mp4")
    },
    {
        title: "ARC Tutorial (8/12)",
        content: "In the clip below, we show how you can also use the <strong>Select Tool</strong> to <strong>Copy</strong> (by pressing C after selection) and to <strong>Paste</strong> at a location (by pressing V). You can copy from both the test input grid and the test output.",
        video: api.getPublicUrl("select-copy-paste-eval.mp4")
    },
    {
        title: "ARC Tutorial (9/12)",
        content: "In the clip below, we show how to use the <strong>Flood Fill Tool</strong> to change the color of connected regions.",
        video: api.getPublicUrl("flood-fill-eval.mp4")
    },
    {
        title: "ARC Tutorial (10/12)",
        content: "In the clip below, we show how you can use the <strong>Undo</strong> button to revert an action you have done.",
        video: api.getPublicUrl("undo-eval.mp4")
    },
    {
        title: "ARC Tutorial (11/12)",
        content: "Finally, when you think you have the correct solution, press the Submit button as shown below. You will have <strong>three attempts for each task </strong>before moving onto the next one, and there will be <strong>five tasks in total.</strong> There is <strong>no time limit for completing each task</strong>. It will likely take around 30 minutes to complete the experiment but you are given a total of <strong>90 minutes</strong>. The next screen will take you to the tutorial interface, where you will attempt to recreate the solution for this example task, before proceeding to the main experiment.",
        video: api.getPublicUrl("submit-eval.mp4")
    },
    {
        title: "ARC Tutorial (12/12)",
        content: "<p><strong>WARNING!</strong></p>If you refresh the experiment, you will be taken back to the beginning of the experiment. This will break the flow of the experiment and you may not be able to finish the experiment. Furthermore, your data will not be saved and your compensation will be reduced depending on how many tasks you have completed."
    }
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
            <button class="button is-warning" @click="prev" :disabled="currentSlideIndex === 0">
                <FAIcon icon="fa-solid fa-arrow-left" />&nbsp; Previous
            </button>
            <div class="dots-container">
                <span v-for="(slide, index) in slides" :key="index" class="dot"
                    :class="{ active: currentSlideIndex === index }" @click="goToSlide(index)">
                </span>
            </div>
            <button class="button is-success" @click="next">
                <template v-if="currentSlideIndex === slides.length - 1">
                    That was easy!
                </template>
                <template v-else>
                    Continue &nbsp;
                    <FAIcon icon="fa-solid fa-arrow-right" />
                </template>
            </button>
        </div>
    </div>
</template>

<style scoped>
.tutorial-slides-view {
    width: 50%;
    /* Similar to the demographics form's width */
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    overflow-y: auto;
    max-height: 90vh;
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
    /* Remove these styles as they'll be handled by Bulma's button classes */
    padding: 10px 18px;
    border: none;
    color: inherit;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
}

.slide-navigation button:disabled {
    opacity: 0.5;
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
