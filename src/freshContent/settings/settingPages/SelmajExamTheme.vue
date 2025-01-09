<template>
  <p class="max-line p-margin">
    Dieses Feature fügt Graphen für die Notenverteilungen und Versuchstracker in
    Selma hinzu. Zusätzlich wird das Layout und Design angepasst
    und die eigene Note in der Notenverteilung angezeigt.
  </p>

  <Setting
    v-model="selmajExamTheme"
    txt="Das jExam Theme in Selma benutzen"
    class="setting"
  />
</template>

<script lang="ts">
import { defineComponent, onBeforeMount, ref, watch } from 'vue'

// components
import Setting from '../components/Setting.vue'

export default defineComponent({
  components: {
    Setting
  },
  setup () {
    const selmajExamTheme = ref(false)

    onBeforeMount(async () => {
      const { selmajExamTheme: storedValue } = await chrome.storage.local.get([
        'selmajExamTheme'
      ])

      selmajExamTheme.value = storedValue ?? false
      watch(selmajExamTheme, valueUpdate)
    })

    const valueUpdate = async () => {
      // When we got here, we have the permission
      await chrome.storage.local.set({
        selmajExamTheme: selmajExamTheme.value
      })
    }

    return {
      selmajExamTheme
    }
  }
})
</script>

<style lang="sass" scoped>
.setting
    margin-bottom: .8rem
</style>
