<script setup>
import { computed } from 'vue'
// setup the info for the page here

// main title
const title = 'H-ARC: A Comprehensive Behavioral Dataset for the Abstraction and Reasoning Corpus'
//subtitle
const subtitle = 'How do people reason about abstract visual program synthesis problems?'

// access today's date
const lastupdated = __BUILD_TIME__

// site author (who is publishing this or made the present mode site?)
const siteauthor = {
  name: 'Solim LeGris',
  link: 'https://solimlegris.com',
}

// project authors (who made the project?)
const projectauthors = [
  {
    name: 'Solim LeGris',
    link: 'https://solimlegris.com',
    affiliation: 'New York University',
  },
  {
    name: 'Wai Keen Vong',
    link: 'https://www.waikeenvong.com/',
    affiliation: ['Meta'],
  },
  {
    name: 'Brenden Lake',
    link: 'https://cims.nyu.edu/~brenden/',
    affiliation: ['New York University'],
  },
  {
    name: 'Todd Gureckis',
    link: 'https://todd.gureckislab.org',
    affiliation: ['New York University'],
  }
]

// a list of project info include urls to prprints
// the link field is optional
const info = [
  // {
  //   title: 'DOI',
  //   data: '10.23915/distill.00032',
  //   link: 'https://doi.org/10.23915/distill.00032',
  // },
  {
    title: 'Publication',
    data: 'Under review',
    link: '',
  },
  {
    title: 'Project Site',
    data: 'arc-visualizations.github.io',
    link: 'https://arc-visualizations.github.io/',
  },
  {
    title: 'Experiment code',
    data: 'Github repo',
    link: 'https://github.com/Le-Gris/harc-viewer',
  },
  {
    title: 'Dataset',
    data: 'OSF repo',
    link: 'https://osf.io/bh8yq/',
  },
]

const uniqueAffiliations = computed(() => {
  const affiliations = projectauthors.flatMap((author) =>
    Array.isArray(author.affiliation) ? author.affiliation : [author.affiliation]
  )
  return [...new Set(affiliations)]
})

function getUniqueAffiliations(affiliation) {
  return Array.isArray(affiliation) ? affiliation : [affiliation]
}
function getAffiliationIndex(affiliation) {
  return uniqueAffiliations.value.indexOf(affiliation) + 1
}
</script>

<template>
  <div class="present-body">
    <section class="present-title">
      <div class="body">
        <div class="maintitle">{{ title }}</div>
        <br />
        <div class="subtitle">{{ subtitle }}</div>
      </div>
    </section>
    <section class="present-author">
      <div class="body">
        <div class="columns">
          <div class="column is-6">
            <!-- authors and affiliations list -->
            <div class="columns">
              <div class="column is-5">
                <div class="info-header">Authors</div>
                <div class="info-data" v-for="(author, index) in projectauthors" :key="index">
                  <template v-if="author.link">
                    <a :href="author.link">{{ author.name }}</a>
                  </template>
                  <template v-else>
                    {{ author.name }}
                  </template>
                  <sup>
                    <template v-for="(aff, affIndex) in getUniqueAffiliations(author.affiliation)" :key="affIndex">
                      {{ getAffiliationIndex(aff)
                      }}{{ affIndex < getUniqueAffiliations(author.affiliation).length - 1 ? ',' : '' }} </template>
                  </sup>
                </div>
              </div>
              <div class="column is-7">
                <div class="info-header">Affiliation</div>
                <div class="info-data" v-for="(aff, index) in uniqueAffiliations" :key="index">
                  <sup>{{ index + 1 }}</sup>&nbsp;{{ aff }}
                </div>
              </div>
            </div>
          </div>
          <div class="column is-2">
            <div class="info-header">Last updated</div>
            <div class="info-data">{{ lastupdated }}</div>
          </div>
          <div class="column is-4">
            <template v-for="i in info">
              <div class="info-header">{{ i.title }}</div>
              <div class="info-data">
                <a v-if="i.link" :href="i.link">{{ i.data }}</a>
                <template v-else>{{ i.data }}</template>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>
    <div class="content">
      <p class="is-size-6 has-text-left">
        <strong>H-ARC (Human-ARC)</strong> is a comprehensive behavioral dataset for the Abstraction and Reasoning
        Corpus
        (ARC), a
        benchmark designed to test analogical generalization and program synthesis in both humans and machines.
      </p>
      <p class="is-size-6 has-text-left">
        <strong>What is ARC?</strong><br>
        The ARC benchmark, introduced by François Chollet, challenges solvers to infer abstract rules from a handful of
        visual input-output examples and apply them to novel test cases. While recent AI models have made rapid progress
        on
        many benchmarks, ARC remains a uniquely difficult challenge for both humans and machines, requiring
        compositional
        reasoning, abstraction, and flexible problem-solving.
      </p>
      <p class="is-size-6 has-text-left">
        <strong>What does H-ARC provide?</strong><br>
        H-ARC presents the largest human evaluation of ARC to date, collecting over 15,000 solution attempts and
        detailed
        action traces from more than 1,700 participants on the full set of 400 training and 400 evaluation ARC tasks.
        For
        each problem, the dataset includes:
      <ul>
        <li><strong>Step-by-step behavioral action traces</strong>: Every click, tool use, and grid edit made by
          participants as they constructed their solutions.</li>
        <li><strong>Natural-language solution descriptions</strong>: Free-form explanations of the inferred rules or
          programs, written by participants.</li>
        <li><strong>Comprehensive performance data</strong>: Success rates, error patterns, and learning curves across
          tasks
          and attempts.</li>
        <li><strong>Demographic and feedback data</strong>: Anonymized participant information and qualitative feedback.
        </li>
      </ul>
      All data is available under a CC0 1.0 Universal
      license, supporting open research in cognitive science and artificial intelligence.
      </p>
      <p class="is-size-6 has-text-left">
        <strong>Why is this important?</strong><br>
      <ul>
        <li><strong>Benchmarking AI</strong>: H-ARC provides a robust, large-scale estimate of human performance on ARC,
          serving as a critical benchmark for evaluating and inspiring new AI models.</li>
        <li><strong>Understanding human reasoning</strong>: The dataset enables in-depth analysis of how people solve
          abstract problems, including the strategies, errors, and conceptual leaps that characterize human
          intelligence.
        </li>
        <li><strong>Pushing AI forward</strong>: Current SOTA models achieved impressive results on <a
            href="https://arcprize.org/arc-agi">ARC-AGI-1</a> (the ARC
          dataset we used for our experiments), but these results were achieved using models that require orders of
          magnitude more training data than people. We hope deeper analysis of this dataset inspires more human-like AI
          models that can flexibly reason in more resource-constrained settings.</li>
      </ul>
      </p>
      <p class="is-size-6 has-text-left">
        <em>The H-ARC dataset and platform are described in our paper, currently under review at Scientific Data. This
          site
          is intended to showcase the experiment interface and make the data and tools accessible to the research
          community
          and the public.</em>
      </p>
      <hr />
      <h3 class="is-size-5">Start from beginning</h3>
      <p class="is-size-6">
        Start the experiment from the very beginning as if you were a real participant. Your data will not be saved,
        though some local storage may be used while you are on the page.
      </p>
      <a href="#/welcome" class="button is-amber is-small">Start &nbsp;
        <FAIcon icon="fa-solid fa-arrow-right" />
      </a>
      <hr />
      <h3 class="is-size-5">Instructions</h3>
      <p class="is-size-6">
        Go to the task instructions to learn about how to play the game. After several pages of instructions, you can
        try out the comprehension quiz that real participants must pass to continue.
      </p>
      <a href="#/tutorial_slides" class="button is-teal is-small">Instructions &nbsp;
        <FAIcon icon="fa-solid fa-arrow-right" />
      </a>
      <hr />
      <h3 class="is-size-5">Explore the dataset</h3>
      <p class="is-size-6">
        If you want to explore the dataset
      </p>
      <a href="#/captcha" class="button is-emerald is-small">Captcha &nbsp;
        <FAIcon icon="fa-solid fa-arrow-right" />
      </a>
    </div>
    <footer class="present-footer">
      <div class="has-text-centered">
        <p>
          Created by <a :href="siteauthor.link">{{ siteauthor.name }}</a> using 🫠
          <a href="https://smile.gureckislab.org">Smile</a>.
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.present-body {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.present-footer {
  background-color: var(--dev-bar-mild-grey);
  padding: 20px;
  height: 100px;
  text-align: center;
  font-size: 14px;
}

.present-title {
  background-color: var(--dev-bar-light-grey);
  padding: 0px;
  padding-top: 70px;
  padding-bottom: 40px;
  text-align: left;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}

.present-title .body,
.present-author .body {
  padding: 10px;
  width: 65%;
  text-align: left;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.1;
}

.present-author {
  margin-bottom: 30px;
  margin-left: auto;
  margin-right: auto;
  padding-top: 20px;
  text-align: left;
  border-bottom-color: var(--dev-bar-mild-grey);
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-top-color: var(--dev-bar-mild-grey);
  border-top-width: 1px;
  border-top-style: solid;
  width: 100%;
}

.present-title .maintitle {
  font-size: 50px;
  font-weight: bold;
}

.present-title.subtitle {
  font-size: 20px;
}

.info-header {
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 200;
  letter-spacing: 0.05em;
  padding-bottom: 0.8em;
  color: var(--dev-bar-dark-grey);
}

.info-data {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.05em;
  padding-bottom: 0.8em;
  color: black;
}

.content {
  width: 65%;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: auto;
  padding-bottom: 60px;
  text-align: left;
}

.is-pink {
  background-color: #ffc0cb;
}

.is-amber {
  background-color: #fda90b;
  color: #935610;
  border-color: #ea9809;
}

.is-teal {
  background-color: #22afd65c;
  color: #1f8abb;
  border-color: #91c2d1;
}

.is-sky {
  background-color: #0e7de45c;
  color: #1f8abb;
  border-color: #91c2d1;
}

.is-emerald {
  background-color: #0fe7785c;
  color: #0d722d;
  border-color: #1ac444;
}
</style>
