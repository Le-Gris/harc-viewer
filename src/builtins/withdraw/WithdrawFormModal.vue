<script setup>
import { reactive, onMounted } from 'vue'
// import and initalize smile API
import useAPI from '@/core/composables/useAPI'
const api = useAPI()
// get access to the global store
const emit = defineEmits(['toggleWithdraw', 'submitWithdraw'])
const props = defineProps(['prefillEmail'])

const forminfo = reactive({
  reason_select: '',
  reason_comments: '',
  email: '',
})

function withdraw() {
  api.setWithdrawn(forminfo) // set withdraw data fields
  api.saveData(true) // force a data save
  emit('submit-withdraw')
}
</script>

<template>
  <article class="message is-danger">
    <div class="message-header">
      <p>Withdraw from study</p>
    </div>
    <div class="message-body has-text-left">
      <p class="has-text-left">
        <b>
          You are free to withdraw from this study at any time. Withdrawing from the study may affect the total amount
          of your compensation. Please complete the following form to complete your withdraw. We will follow up with you
          about partial compensation. You do not have to answer any particular question but we appreciate understanding
          the reasons for your withdraw.
        </b>
      </p>
      <br />
      <p>
        <FormKit
          v-model="forminfo.reason_select"
          type="checkbox"
          label="Why are you withdrawing from the study? (Optional)"
          :options="[
            'I couldn\'t adjust the size of my browser to make everything visible',
            'This task is too hard.',
            'This task is too time consuming.',
            'This task is boring.',
            'I do not understand what I am supposed to do.',
            'I am uncomfortable answering the questions.',
            'The content of the task is upsetting to me.',
            'I am having technical issues.',
          ]"
          decorator-icon="happy"
          help="Select all that apply."
          validation="required|min:3"
        />
        <FormKit
          v-model="forminfo.reason_comments"
          type="textarea"
          label="Additional comments. (Optional)"
          rows="5"
          placeholder="Enter your comments here."
          help="Please let us know any additional information you would like to share."
        />
        <FormKit
          v-model="props.prefillEmail"
          type="email"
          label="Contact email. (Optional)"
          help="Please enter your email address so we can follow up with you.  This is optional and we otherwise will try to figure out how to reach you.  However, this can help avoid any potential problems.  Feel free to use an anonymized email like your Prolific contact email, Hide my email (Apple), or create a free alias on SimpleLogin.  We will not associate this email with your data nor use it for any purpose other than contacting you to resolve the issue."
          validation="email"
          validation-visibility="live"
          placeholder="participant@gmail.com"
        />
      </p>
      <div class="has-text-right mt-6">
        <button class="button mr-4" id="nevermind" @click="$emit('toggleWithdraw')">
          Nevermind, take me back to the study!
        </button>
        <button class="button is-danger mr-3" id="finish" @click="withdraw()">Withdraw</button>
      </div>
    </div>
  </article>
</template>
