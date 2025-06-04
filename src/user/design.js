// design.js
import { markRaw } from 'vue'
import { processQuery } from '@/core/utils'

// Built-in Views
import Advertisement from '@/builtins/advertisement/AdvertisementView.vue'
import MTurk from '@/builtins/mturk/MTurkRecruitView.vue'
import Consent from '@/builtins/simple_consent/InformedConsentView.vue'
import DemographicSurvey from '@/builtins/demographic_survey/DemographicSurveyView.vue'
import Debrief from '@/builtins/debrief/DebriefView.vue'
import Thanks from '@/builtins/thanks/ThanksView.vue'
import Withdraw from '@/builtins/withdraw/WithdrawView.vue'
import WindowSizer from '@/builtins/window_sizer/WindowSizerView.vue'

// User Views for ARC Experiment
import TutorialSlidesView from '@/user/components/TutorialSlidesView.vue'
import TutorialQuizView from '@/user/components/TutorialQuizView.vue'
import ArcTaskRunnerView from '@/user/components/ArcTaskRunnerView.vue'
import ExperimentFinishedView from '@/user/components/ExperimentFinishedView.vue'

// Import task file lists for randomization
import trainingFileNames from '@/user/assets/arcTrainingFileNames'
import evaluationFileNames from '@/user/assets/arcEvalFileNames'

import useAPI from '@/core/composables/useAPI'
import Timeline from '@/core/timeline'
import { EXPERIMENT_CONFIG } from '@/user/utils/arcConstants'
import { sampleWithoutReplacement } from '@/core/randomization'

const api = useAPI()
const timeline = new Timeline(api)

// Runtime Config
api.setRuntimeConfig('allowRepeats', false)
api.setRuntimeConfig('windowsizerRequest', { width: 800, height: 600 })
api.setRuntimeConfig('windowsizerAggressive', true)

import InformedConsentText from './components/InformedConsentText.vue'
api.setAppComponent('informed_consent_text', InformedConsentText)

// --- Two-Level Randomization Setup ---
// Level 1: Assign participants to dataset (training vs evaluation)
api.randomAssignCondition({
  dataset: ['training', 'evaluation'],
})

// Level 2: Create randomized task lists for each dataset condition
// Create randomized task selections for each dataset using core randomization function
const trainingTaskSelection = sampleWithoutReplacement(trainingFileNames, EXPERIMENT_CONFIG.MAX_TASKS_PER_EXPERIMENT)
const evaluationTaskSelection = sampleWithoutReplacement(
  evaluationFileNames,
  EXPERIMENT_CONFIG.MAX_TASKS_PER_EXPERIMENT
)

// Store the task selections in the API for access by components
api.setRuntimeConfig('trainingTaskSelection', trainingTaskSelection)
api.setRuntimeConfig('evaluationTaskSelection', evaluationTaskSelection)

// Function to get the appropriate task filename based on condition and task number
function getTaskFileName(taskNumber) {
  const dataset = api.getConditionByName('dataset')
  const taskSelection = dataset === 'training' ? trainingTaskSelection : evaluationTaskSelection
  return taskSelection[taskNumber - 1] // taskNumber is 1-indexed, array is 0-indexed
}

// Function to get the tutorial task filename (from opposite dataset)
function getTutorialTaskFileName() {
  const dataset = api.getConditionByName('dataset')
  // Use task from opposite dataset to avoid overlap with experiment tasks
  if (dataset === 'training') {
    return '21f83797.json' // From evaluation set
  } else {
    return 'e9afcf9a.json' // From training set
  }
}

// --- Timeline Definition ---

// Welcome / MTurk
timeline.pushSeqView({
  path: '/welcome',
  name: 'welcome_anonymous',
  component: Advertisement,
  meta: { prev: undefined, next: 'consent', allowAlways: true, requiresConsent: false },
  beforeEnter: (to) => {
    api.getBrowserFingerprint()
  },
})

timeline.pushSeqView({
  path: '/welcome/:service',
  name: 'welcome_referred',
  component: Advertisement,
  meta: { prev: undefined, next: 'consent', allowAlways: true, requiresConsent: false },
  beforeEnter: (to) => {
    processQuery(to.query, to.params.service)
    api.getBrowserFingerprint()
  },
})

timeline.registerView({
  name: 'mturk',
  component: MTurk,
  meta: { allowAlways: true, requiresConsent: false },
  beforeEnter: (to) => {
    processQuery(to.query, 'mturk')
  },
})

// Consent
timeline.pushSeqView({
  name: 'consent',
  component: Consent,
  props: { informedConsentText: markRaw(InformedConsentText) },
  meta: { requiresConsent: false, setConsented: true },
})

// Demographic Survey
timeline.pushSeqView({ name: 'demograph', component: DemographicSurvey })

// Window Sizer
timeline.pushSeqView({ name: 'windowsizer', component: WindowSizer })

// --- ARC Experiment Flow ---
// Tutorial Slides
timeline.pushSeqView({
  name: 'tutorial_slides',
  component: TutorialSlidesView,
  meta: { next: 'tutorial_task_runner' },
})

// Tutorial Task
timeline.pushSeqView({
  name: 'tutorial_task_runner',
  component: ArcTaskRunnerView,
  props: {
    taskFileName: getTutorialTaskFileName(),
    datasetType: (() => {
      const dataset = api.getConditionByName('dataset')
      return dataset === 'training' ? 'evaluation' : 'training' // opposite dataset
    })(),
    isTutorialMode: true,
    taskNumber: 0,
    totalTasks: 0,
  },
  meta: { next: 'tutorial_quiz' },
  beforeEnter: (to) => {
    // Log the tutorial task assignment for debugging and data analysis
    const tutorialTask = getTutorialTaskFileName()
    const dataset = api.getConditionByName('dataset')
    const oppositeDataset = dataset === 'training' ? 'evaluation' : 'training'
    console.log(
      `Loading tutorial task: ${tutorialTask} from ${oppositeDataset} dataset (participant assigned to ${dataset} dataset)`
    )
  },
})

// Tutorial Quiz
timeline.pushSeqView({
  name: 'tutorial_quiz',
  component: TutorialQuizView,
  meta: { next: 'experiment_task_1' },
})

// Experiment Tasks - Create tasks dynamically with proper taskFileName assignment
for (let i = 1; i <= EXPERIMENT_CONFIG.MAX_TASKS_PER_EXPERIMENT; i++) {
  timeline.pushSeqView({
    name: `experiment_task_${i}`,
    component: ArcTaskRunnerView,
    props: {
      taskFileName: getTaskFileName(i), // Now properly assigned based on randomization
      datasetType: api.getConditionByName('dataset'), // Use assigned dataset
      isTutorialMode: false,
      taskNumber: i,
      totalTasks: EXPERIMENT_CONFIG.MAX_TASKS_PER_EXPERIMENT,
    },
    meta: i === EXPERIMENT_CONFIG.MAX_TASKS_PER_EXPERIMENT ? { next: 'finished_experiment' } : {},
    beforeEnter: (to) => {
      // Log the task assignment for debugging and data analysis
      console.log(
        `Loading experiment task ${i}: ${getTaskFileName(i)} from ${api.getConditionByName('dataset')} dataset`
      )
    },
  })
}

// Finished Experiment (Feedback)
timeline.pushSeqView({
  name: 'finished_experiment',
  component: ExperimentFinishedView,
  meta: { next: 'debrief' },
})

// --- Standard Post-Experiment Views ---
import DebriefText from '@/user/components/DebriefText.vue'
timeline.pushSeqView({
  name: 'debrief',
  component: Debrief,
  props: { debriefText: markRaw(DebriefText) },
})

timeline.pushSeqView({
  name: 'thanks',
  component: Thanks,
  meta: { requiresDone: true, resetApp: api.getConfig('allowRepeats') },
})

timeline.registerView({
  name: 'withdraw',
  component: Withdraw,
  meta: { requiresWithdraw: true, resetApp: api.getConfig('allowRepeats') },
})

timeline.build()
export default timeline
