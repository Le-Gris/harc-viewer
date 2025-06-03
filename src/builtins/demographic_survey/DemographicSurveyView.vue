<script setup>
import { reactive, computed } from 'vue'

// import and initalize smile API
import useViewAPI from '@/core/composables/useViewAPI'
const api = useViewAPI()

const pages = api.spec().append([{ path: 'survey_page1' }, { path: 'survey_page2' }, { path: 'survey_page3' }])
api.addSpec(pages)

// persists the form info in local storage, otherwise initialize
if (!api.globals.forminfo) {
  api.globals.forminfo = reactive({
    age: '',
    gender: '',
    race: [],
    fluent_english: '',
    normal_vision: '',
    color_blind: '',
    education_level: '',
    household_income: '',
  })
}

const page_one_complete = computed(
  () =>
    api.globals.forminfo.age !== '' &&
    api.globals.forminfo.gender !== '' &&
    api.globals.forminfo.race.length > 0 &&
    api.globals.forminfo.fluent_english !== ''
)

const page_two_complete = computed(
  () =>
    api.globals.forminfo.normal_vision !== '' &&
    api.globals.forminfo.color_blind !== ''
)

const page_three_complete = computed(
  () =>
    api.globals.forminfo.education_level !== '' &&
    api.globals.forminfo.household_income !== ''
)

function autofill() {
  api.globals.forminfo.age = '1'
  api.globals.forminfo.gender = 'Man'
  api.globals.forminfo.race = ['White']
  api.globals.forminfo.fluent_english = 'Yes'
  api.globals.forminfo.normal_vision = 'Yes'
  api.globals.forminfo.color_blind = 'No'
  api.globals.forminfo.education_level = 'Doctorate Degree (PhD/Other)'
  api.globals.forminfo.household_income = '$100,000-$199,999'
}

api.setAutofill(autofill)

function finish() {
  api.recordForm('demographicForm', api.globals.forminfo)
  api.goNextView()
}
</script>

<template>
  <div class="page prevent-select">
    <div class="formcontent">
      <h3 class="is-size-3 has-text-weight-bold">
        <FAIcon icon="fa-solid fa-person" />&nbsp;Demographic Information
      </h3>
      <p class="is-size-6">
        The following questions will help us understand the extent to which the participants of this study are
        representative of the US population. Your privacy will be maintained. For all questions, you have the option
        of indicating 'Prefer not to specify.'
      </p>
      <div class="formstep" v-if="api.paths === 'survey_page1'">
        <div class="columns">
          <div class="column is-one-third">
            <!-- Remove formsectionexplainer -->
          </div>
          <div class="column">
            <div class="box is-shadowless formbox">
              <FormKit type="number" label="Age (in years)" placeholder="Enter your age" name="age"
                v-model="api.globals.forminfo.age" help="Enter your age (required)" validation="required" value="0"
                step="1" />
              <FormKit type="select" label="Gender" name="gender" help="Enter your self-identified gender (required)"
                placeholder="Select an option"
                :options="['Man', 'Woman', 'Non-binary/Genderqueer', 'Other', 'Prefer not to specify']"
                v-model="api.globals.forminfo.gender" validation="required" />
              <FormKit type="select" label="Are you able to speak and understand English?" name="english"
                v-model="api.globals.forminfo.fluent_english"
                help="Are you able to speak and understand English? (required)" placeholder="Select an option"
                validation="required" :options="['Yes', 'No', 'Prefer not to specify']" />
              <FormKit type="checkbox" label="Which best describes your race/ethnicity?" name="race"
                v-model="api.globals.forminfo.race" validation="required" help="Select one or more"
                :options="['Asian', 'Black/African American', 'Hispanic/Latinx', 'Middle Eastern/North African', 'Native American/Alaska Native/First Nations', 'Pacific Islander/Native Hawaiian', 'White', 'Prefer not to specify']" />
              <hr />
              <div class="columns">
                <div class="column">
                  <div class="has-text-right">
                    <button class="button is-warning" id="finish" v-if="page_one_complete" @click="api.goNextStep()">
                      Continue &nbsp;
                      <FAIcon icon="fa-solid fa-arrow-right" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="formstep" v-else-if="api.paths === 'survey_page2'">
        <div class="columns">
          <div class="column is-one-third">
            <!-- Remove formsectionexplainer -->
          </div>
          <div class="column">
            <div class="box is-shadowless formbox">
              <FormKit type="select" name="vision" label="Do you have normal vision (or corrected to be normal)?"
                help="Do you have normal vision? (required)" placeholder="Select an option" validation="required"
                v-model="api.globals.forminfo.normal_vision" :options="['Yes', 'No', 'Prefer not to specify']" />
              <FormKit type="select" name="colorblind" label="Are you color blind?"
                help="Do you have any color blindness? (required)" placeholder="Select an option" validation="required"
                v-model="api.globals.forminfo.color_blind" :options="['Yes', 'No', 'Prefer not to specify']" />
              <hr />
              <div class="columns">
                <div class="column">
                  <div class="has-text-left">
                    <button class="button is-warning" id="finish" @click="api.goPrevStep()">
                      <FAIcon icon="fa-solid fa-arrow-left" />&nbsp; Previous
                    </button>
                  </div>
                </div>
                <div class="column">
                  <div class="has-text-right">
                    <button class="button is-warning" id="finish" v-if="page_two_complete" @click="api.goNextStep()">
                      Continue &nbsp;
                      <FAIcon icon="fa-solid fa-arrow-right" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="formstep" v-else-if="api.paths === 'survey_page3'">
        <div class="columns">
          <div class="column is-one-third">
            <!-- Remove formsectionexplainer -->
          </div>
          <div class="column">
            <div class="box is-shadowless formbox">
              <FormKit type="select" name="education"
                label="What is the highest level of education/schooling that you completed?"
                placeholder="Select an option" v-model="api.globals.forminfo.education_level"
                help="What is your highest level of schooling that you completed? (required)" validation="required"
                :options="[
                  'No Formal Qualifications',
                  'Secondary Education (ie. GED/GCSE)',
                  'High School Diploma (A-levels)',
                  'Technical/Community College',
                  'Undergraduate Degree (BA/BS/Other)',
                  'Graduate Degree (MA/MS/MPhil/Other)',
                  'Doctorate Degree (PhD/Other)',
                  'Don\'t Know/Not Applicable',
                  'Prefer not to specify',
                ]" />
              <FormKit type="select" name="income" label="What is your approximate household income?"
                help="What is your approximate household income? (required)" placeholder="Select an option"
                validation="required" v-model="api.globals.forminfo.household_income" :options="[
                  'Less than $20,000',
                  '$20,000–$39,999',
                  '$40,000–$59,999',
                  '$60,000–$79,999',
                  '$80,000–$99,999',
                  '$100,000–$199,999',
                  '$200,000–$299,999',
                  '$300,000–$399,999',
                  '$400,000–$499,999',
                  '$500,000+',
                  'I don\'t know',
                  'Prefer not to specify',
                ]" />
              <hr />
              <div class="columns">
                <div class="column">
                  <div class="has-text-left">
                    <button class="button is-warning" id="finish" @click="api.goPrevStep()">
                      <FAIcon icon="fa-solid fa-arrow-left" />&nbsp; Previous
                    </button>
                  </div>
                </div>
                <div class="column">
                  <div class="has-text-right">
                    <button class="button is-success" id="finish" v-if="page_three_complete" @click="finish()">
                      That was easy!
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="formstep" v-else>
        <article class="message is-danger">
          <div class="message-header">
            <p>Error</p>
            <button class="delete" aria-label="delete"></button>
          </div>
          <div class="message-body">
            Error, you shouldn't have been able to get this far! This happened because the stepper for this route has
            been incremented too many times. There's no problem so long as your code doesn't allow this in live mode.
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style>
.formstep {
  margin-top: 40px;
}

:root {
  --fk-bg-input: #fff;
  --fk-max-width-input: 100%;
}

.formbox {
  border: 1px solid #dfdfdf;
  text-align: left;
  background-color: rgb(248, 248, 248);
}

.formkit-input select {
  background-color: #fff;
}

.formcontent {
  width: 80%;
  margin: auto;
  margin-bottom: 40px;
  padding-bottom: 200px;
  text-align: left;
}

.formsectionexplainer {
  text-align: left;
  color: #777;
}
</style>
