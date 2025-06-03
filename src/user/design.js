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
import TutorialSlidesView from '@/user/views/TutorialSlidesView.vue'
import TutorialQuizView from '@/user/views/TutorialQuizView.vue'
import ArcTaskRunnerView from '@/user/views/ArcTaskRunnerView.vue'
import ExperimentFinishedView from '@/user/views/ExperimentFinishedView.vue'

import useAPI from '@/core/composables/useAPI'
const api = useAPI()
import Timeline from '@/core/timeline'
const timeline = new Timeline(api)
import useSmileStore from '@/core/stores/smilestore'
const smilestore = useSmileStore()

// Runtime Config (as before)
api.setRuntimeConfig('allowRepeats', false)
api.setRuntimeConfig('windowsizerRequest', { width: 800, height: 600 })
api.setRuntimeConfig('windowsizerAggressive', true)
// ... other configs ...
import InformedConsentText from './components/InformedConsentText.vue' // Assuming this path is correct
api.setAppComponent('informed_consent_text', InformedConsentText)

// Condition Assignment
// Define the list of task files for the experiment
// This should come from your arcEvalFileNames.js or similar
// For example:
import experimentTaskFiles from '@/user/assets/arcEvalFileNames' // ENSURE THIS PATH IS CORRECT
const MAX_EXPERIMENT_TASKS = 5

// Function to select and shuffle tasks
function prepareExperimentTasks() {
  let allTasks = [...experimentTaskFiles] // Use a copy
  // Shuffle (implement or import shuffleArray from uiUtils)
  for (let i = allTasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allTasks[i], allTasks[j]] = [allTasks[j], allTasks[i]]
  }
  return allTasks.slice(0, MAX_EXPERIMENT_TASKS)
}

// Store selected tasks in smilestore so ArcTaskRunnerView can access the *correct* one in sequence
const selectedTasksForRun = prepareExperimentTasks()
smilestore.setSystemData('experiment_task_sequence', selectedTasksForRun)
smilestore.setSystemData('current_experiment_task_index', 0) // To track progress

const TUTORIAL_TASK_FILENAME = 'e9afcf9a.json' // Your tutorial task file

// --- Timeline Definition ---

// Welcome / MTurk (as before)
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
  props: {
    /* ... */
  },
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
// 1. Tutorial Slides
timeline.pushSeqView({
  name: 'tutorial_slides',
  component: TutorialSlidesView,
  meta: { next: 'tutorial_task_runner' }, // Explicitly set next for clarity
})

// 2. Tutorial Task
timeline.pushSeqView({
  name: 'tutorial_task_runner',
  component: ArcTaskRunnerView,
  props: {
    taskFileName: TUTORIAL_TASK_FILENAME, // Specific tutorial task
    isTutorialMode: true,
    taskNumber: 0, // Or some other indicator for tutorial
    totalTasks: 0,
  },
  meta: { next: 'tutorial_quiz' },
})

// 3. Tutorial Quiz
timeline.pushSeqView({
  name: 'tutorial_quiz',
  component: TutorialQuizView,
  // meta: { next: 'experiment_task_1' } // Next will be the first experiment task
})

// 4. Experiment Tasks (Looping or sequential)
// We'll add these dynamically or use a clever routing approach
// For dynamic addition:
selectedTasksForRun.forEach((taskFile, index) => {
  timeline.pushSeqView({
    name: `experiment_task_${index + 1}`,
    component: ArcTaskRunnerView,
    props: {
      taskFileName: taskFile,
      isTutorialMode: false,
      taskNumber: index + 1,
      totalTasks: selectedTasksForRun.length,
    },
    // 'next' will automatically go to the next in sequence, or 'finished_experiment' after the last one
    meta: index === selectedTasksForRun.length - 1 ? { next: 'finished_experiment' } : {},
  })
})

// 5. Finished Experiment (Feedback)
timeline.pushSeqView({
  name: 'finished_experiment',
  component: ExperimentFinishedView,
  meta: { next: 'debrief' }, // Or directly to 'thanks' if debrief is simple
})

// --- Standard Post-Experiment Views ---
// Debrief
import DebriefText from '@/user/components/DebriefText.vue' // Assuming path
timeline.pushSeqView({
  name: 'debrief',
  component: Debrief,
  props: { debriefText: markRaw(DebriefText) },
})

// Thanks
timeline.pushSeqView({
  name: 'thanks',
  component: Thanks,
  meta: { requiresDone: true, resetApp: api.getConfig('allowRepeats') },
})

// Withdraw
timeline.registerView({
  name: 'withdraw',
  component: Withdraw,
  meta: { requiresWithdraw: true, resetApp: api.getConfig('allowRepeats') },
})

timeline.build()
export default timeline
