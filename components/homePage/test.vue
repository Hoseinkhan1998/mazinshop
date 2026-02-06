<script setup>
import { ref, getCurrentInstance, watch, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useMajaziStore } from '../../stores/majazi-store'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import vuedatePicker from '@alireza-ab/vue3-persian-datepicker'
import SearchSelect from '../SearchSelect.vue'
// import BaseSelect from '../BaseSelect.vue'

const route = useRoute()
const router = useRouter()

// --- PROPS & EMITS ---
const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  allTags: { type: Array, default: () => [] },
  unseenChatCount: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'task-updated', 'task-deleted', 'task-moved'])

// --- INSTANCES ---
const { proxy } = getCurrentInstance()
const api = proxy.$api
const $q = useQuasar()

// --- STORE ---
const store = useMajaziStore()
const { user, fellow_list, mediaUrl } = storeToRefs(store)

const active_project_list_for_panel = ref([])

// --- LOCAL STATE ---
const activeTab = ref(route.query.tab || 'info')
const editableTask = ref(JSON.parse(JSON.stringify(props.task))) // Deep copy for safe editing
const taskUsers = ref(editableTask.value.job.tasks.filter((t) => t.is_committed).map((t) => t.user))
const taskInformees = ref([]) // مطلعین
const newAppendix = ref({ dialog: false, title: '', file: null })
const newChat = ref({ body: '', file: null })

watch(activeTab, (newTab) => {
  if (route.query.tab !== newTab) {
    router.replace({ query: { ...route.query, tab: newTab } })
  }
})

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && activeTab.value !== newTab) {
      activeTab.value = newTab
    }
  },
)

const unreadChatIds = ref(new Set())

function rebuildUnreadChatIds() {
  const count = Math.max(0, Number(props.unseenChatCount || 0))
  const chats = editableTask.value?.job?.chats || []
  // ✅ فقط همان لحظه اول باز شدن تسک، پیام‌های unread را فریز کن
  unreadChatIds.value = new Set(chats.slice(0, count).map((c) => c.id))
}

function isUnreadChat(chatId) {
  return unreadChatIds.value.has(chatId)
}

async function fetchConfirmStatus(jobId) {
  if (!jobId) return
  try {
    const { data } = await api.get('pm/job-confirm-status', {
      params: { job_id: jobId },
    })

    // مستقیماً استیت محلی را آپدیت می‌کنیم
    if (editableTask.value && editableTask.value.job) {
      editableTask.value.job.confirm = data.confirm_status
    }
  } catch (e) {
    console.error('Failed to fetch confirm status:', e)
    // در صورت خطا، چیزی نمایش نده. دکمه همان وضعیت قبلی را نشان می‌دهد
  }
}

function loadActiveProjectList() {
  const selectedMembers = taskUsers.value

  if (!selectedMembers || !selectedMembers.length) {
    active_project_list_for_panel.value = [{ id: 1, title: 'سایر (امور جاری)' }]
    return
  }

  const units = fellow_list.value.filter((f) => selectedMembers.includes(f.id)).map((f) => f.unit)

  if (units.length) {
    api
      .get('prj/active-project-list-in-units/', {
        params: { units: [...new Set(units)].join(',') },
      })
      .then((res) => {
        const projectsFromServer = res.data
        let finalProjectList = [...projectsFromServer]

        const hasDefaultProject = projectsFromServer.some((p) => p.id === 1)
        if (!hasDefaultProject) {
          finalProjectList.unshift({ id: 1, title: 'سایر (امور جاری)' })
        }

        active_project_list_for_panel.value = finalProjectList

        // ✅ تغییر در این دو خط اعمال شده است
        if (!finalProjectList.some((p) => p.id === editableTask.value.job.project)) {
          editableTask.value.job.project = 1
        }
      })
  }
}

// const tabs = [
//   { id: 'info', title: 'مشخصات', icon: 'person_outline' },
//   // { id: 'details', title: 'جزئیات', icon: 'description' },
//   { id: 'message', title: 'پیام‌ها', icon: 'chat_bubble_outline' },
// ]
const statusOptions = ref([
  { label: 'خاتمه', value: 'done' },
  { label: 'درجریان', value: 'doing' },
  { label: 'در نوبت', value: 'todo' },
])
// const urgencyOptions = ref([
//   { label: 'عادی', value: 1 },
//   { label: 'فوری', value: 2 },
//   { label: 'آنی', value: 3 },
// ])

function updateJob(payload) {
  api
    .patch(`pm/update-job/${editableTask.value.job.id}/`, payload)
    .then((response) => {
      Object.assign(editableTask.value.job, response.data)

      emit('task-updated', {
        task_id: editableTask.value.id,
        job: response.data,
        full_task_data: { ...editableTask.value, job: response.data },
      })
    })
    .catch((err) => {
      console.error('Update failed:', err)
      $q.notify({ type: 'negative', message: 'خطا در ذخیره تغییرات' })
    })
}

function addAppendix() {
  if (!newAppendix.value.title || !newAppendix.value.file) {
    $q.notify({ type: 'warning', message: 'لطفا عنوان و فایل را مشخص کنید' })
    return
  }
  const formData = new FormData()
  formData.append('job', editableTask.value.job.id)
  formData.append('title', newAppendix.value.title)
  formData.append('file', newAppendix.value.file)

  $q.loading.show()
  api
    .post('pm/add-job-appendix/', formData)
    .then((response) => {
      editableTask.value.job.appendices.push(response.data)
      newAppendix.value.dialog = false
      newAppendix.value.title = ''
      newAppendix.value.file = null
      $q.notify({ type: 'positive', message: 'پیوست اضافه شد' })
    })
    .catch((err) => console.error(err))
    .finally(() => $q.loading.hide())
}

function removeAppendix(id) {
  $q.dialog({
    title: 'تایید حذف',
    message: 'آیا از حذف این پیوست اطمینان دارید؟',
    dir: 'rtl',
    cancel: { label: 'انصراف', flat: true, class: 'rounded-lg me-4 !text-primarymain' },
    ok: {
      label: 'حذف کن',
      unelevated: true,
      class: '!bg-primarymain text-white rounded-lg px-3 py-2',
    },
    class: '!rounded-xl text-primarymain',
  }).onOk(() => {
    api.delete(`pm/remove-job-appendix/${id}/`).then(() => {
      const index = editableTask.value.job.appendices.findIndex((a) => a.id === id)
      if (index > -1) editableTask.value.job.appendices.splice(index, 1)
      $q.notify({ type: 'info', message: 'پیوست حذف شد' })
    })
  })
}

function addChat() {
  if (!newChat.value.body && !newChat.value.file) return
  const formData = new FormData()
  formData.append('job', editableTask.value.job.id)
  formData.append('user', user.value.id)
  if (newChat.value.body) formData.append('body', newChat.value.body)
  if (newChat.value.file) formData.append('file', newChat.value.file)

  $q.loading.show()
  api
    .post('pm/job-chat-add/', formData)
    .then((response) => {
      editableTask.value.job.chats.unshift(response.data)
      newChat.value = { body: '', file: null }
    })
    .catch((err) => console.error(err))
    .finally(() => $q.loading.hide())
}

function removeChat(id) {
  api.delete(`pm/job-chat-remove/${id}/`).then(() => {
    const index = editableTask.value.job.chats.findIndex((c) => c.id === id)
    if (index > -1) editableTask.value.job.chats.splice(index, 1)
  })
}

function removeTask() {
  $q.dialog({
    title: 'تایید حذف وظیفه',
    message: 'آیا از حذف کامل این وظیفه و تمام اطلاعات آن اطمینان دارید؟ این عمل غیرقابل بازگشت است.',
    dir: 'rtl',
    cancel: { label: 'خیر', flat: true, class: 'rounded-lg me-4 !text-primarymain' },
    ok: {
      label: 'بله، حذف کن',
      unelevated: true,
      class: '!bg-primarymain text-white rounded-lg px-3 py-2',
    },
    class: '!rounded-xl text-primarymain',
  }).onOk(() => {
    api.delete(`pm/remove-job/${editableTask.value.job.id}/`).then(() => {
      $q.notify({ type: 'positive', message: 'وظیفه با موفقیت حذف شد' })
      emit('task-deleted', editableTask.value.id)
    })
  })
}

function archiveTask() {
  const isArchiving = !editableTask.value.job.archive

  $q.dialog({
    title: isArchiving ? 'تایید بایگانی' : 'تایید بازیابی',
    message: isArchiving ? 'آیا از بایگانی کردن این وظیفه اطمینان دارید؟' : 'آیا از خارج کردن این وظیفه از بایگانی اطمینان دارید؟',
    dir: 'rtl',
    cancel: { label: 'انصراف', flat: true, class: 'rounded-lg me-4 !text-primarymain' },
    ok: {
      label: isArchiving ? 'بایگانی کن' : 'بازیابی کن',
      unelevated: true,
      class: '!bg-primarymain text-white rounded-lg px-3 py-2',
    },
    class: '!rounded-xl text-primarymain',
  }).onOk(() => {
    const payload = { archive: isArchiving }

    $q.loading.show({ message: isArchiving ? 'در حال بایگانی...' : 'در حال بازیابی...' })

    api
      .patch(`pm/update-job/${editableTask.value.job.id}/`, payload)
      .then(() => {
        $q.notify({
          type: 'info',
          message: isArchiving ? 'وظیفه بایگانی شد' : 'وظیفه از بایگانی خارج شد',
        })

        // رفتار فعلی خودت: بعدش پنل بسته و از لیست حذف میشه
        emit('task-deleted', editableTask.value.id)
      })
      .catch((err) => {
        console.error('Archive/Unarchive failed:', err)
        $q.notify({ type: 'negative', message: 'عملیات با خطا مواجه شد' })
      })
      .finally(() => {
        $q.loading.hide()
      })
  })
}

function clearDeadline() {
  if (editableTask.value.is_owner) {
    editableTask.value.job.deadline = null
    updateJob({ deadline: null })
    deadlinePickerValue.value = null // دیت‌پیکر هم خالی بشه
  }
}

function mediaDownload(pk, field, title) {
  $q.loading.show({ message: 'در حال آماده‌سازی فایل برای دانلود...' })

  api
    .post('pm/job-media/', { pk: pk, field: field }, { responseType: 'blob' })
    .then((response) => {
      const fileURL = window.URL.createObjectURL(new Blob([response.data]))
      const fileLink = document.createElement('a')

      fileLink.href = fileURL
      fileLink.setAttribute('download', title)
      document.body.appendChild(fileLink)

      fileLink.click()

      document.body.removeChild(fileLink)
      window.URL.revokeObjectURL(fileURL)
    })
    .catch((err) => {
      console.error('Download failed:', err)
      $q.notify({ type: 'negative', message: 'دانلود فایل با خطا مواجه شد' })
    })
    .finally(() => {
      $q.loading.hide()
    })
}

function toggleConfirmation() {
  const newConfirmationStatus = !editableTask.value.job.confirm
  const payload = { confirm: newConfirmationStatus }

  $q.loading.show()

  api
    .patch(`pm/update-job/${editableTask.value.job.id}/`, payload)
    .then((response) => {
      editableTask.value.job.confirm = response.data.confirm

      emit('task-updated', {
        task_id: editableTask.value.id,
        job: response.data,
        full_task_data: { ...editableTask.value, job: response.data },
      })

      $q.notify({
        type: 'positive',
        message: newConfirmationStatus ? 'انجام کار تایید شد' : 'تایید انجام کار لغو شد',
      })
    })
    .catch((err) => {
      console.error('Confirmation toggle failed:', err)
      $q.notify({ type: 'negative', message: 'عملیات با خطا مواجه شد' })
    })
    .finally(() => {
      $q.loading.hide()
    })
}

const selectedBoardLabel = computed(() => {
  const tag = editableTask.value?.tag
  if (tag === null) return 'کارهای من'
  return props.allTags?.find((t) => t.id === tag)?.title || ''
})

const boardOptions = computed(() => {
  const currentTag = editableTask.value?.tag ?? null
  const filteredTags = (props.allTags || []).filter((t) => t.id !== currentTag)

  if (currentTag === null) {
    return filteredTags
  }

  return [{ id: null, title: 'کارهای من' }, ...filteredTags]
})

function changeTaskTag(newTagId) {
  const oldTagId = editableTask.value.tag

  if (oldTagId === newTagId) return

  const payload = {
    task: editableTask.value.id,
    tag: newTagId,
  }

  $q.loading.show({ message: 'در حال انتقال وظیفه...' })

  api
    .post('pm/change-task-tag/', payload)
    .then((response) => {
      editableTask.value.tag = newTagId

      emit('task-moved', {
        oldTagId: oldTagId,
        taskStatus: editableTask.value.job.status,
        movedTask: response.data,
      })

      $q.notify({ type: 'positive', message: 'وظیفه به بورد جدید منتقل شد' })
    })
    .catch((err) => {
      console.error('Failed to change task tag:', err)
      $q.notify({ type: 'negative', message: 'خطا در انتقال وظیفه' })
      // بازگرداندن تگ به حالت قبلی در صورت خطا (اختیاری)
      // editableTask.value.tag = oldTagId
    })
    .finally(() => {
      $q.loading.hide()
    })
}

const filteredFellowList = computed(() => {
  if (editableTask.value.is_owner) {
    return fellow_list.value
  }
  return fellow_list.value.filter((f) => f.id !== user.value.id)
})

const isMembersListReadonly = computed(() => {
  if (editableTask.value.is_owner) {
    return false
  }
  if (filteredFellowList.value.length === 0) {
    return true
  }
  return false
})

const filteredFellowListForInformees = computed(() => {
  // فعلاً طبق گفته تو، آپشن‌ها دقیقاً مثل مسئولان
  if (editableTask.value.is_owner) return fellow_list.value
  return fellow_list.value.filter((f) => f.id !== user.value.id)
})

const isInformeesReadonly = computed(() => {
  if (editableTask.value.is_owner) return false
  if (filteredFellowListForInformees.value.length === 0) return true
  return false
})

const informeeOptionsPanel = ref([])

watch(
  filteredFellowListForInformees,
  (v) => {
    informeeOptionsPanel.value = v || []
  },
  { immediate: true },
)

function filterInformeesPanel(val, update) {
  const sourceList = filteredFellowListForInformees.value || []

  if (!val) {
    update(() => {
      informeeOptionsPanel.value = sourceList
    })
    return
  }

  update(() => {
    const needle = String(val).toLowerCase()
    informeeOptionsPanel.value = sourceList.filter((u) => (u.name || '').toLowerCase().includes(needle))
  })
}

function handleInformeesChange() {
  const old = [...taskInformees.value]

  const payload = {
    task: editableTask.value.id,
    informees: taskInformees.value, // اسم فیلد سمت بک
  }

  api
    .post('pm/job-informees-change/', payload) // اسم endpoint پیشنهادی
    .then((response) => {
      // بسته به اینکه بک چی برگردونه:
      // اگر job/tasks برگردوند، اینجا اصلاحش کن
      if (response?.data?.informees) {
        // اگر بک خود informees رو برگردوند
        taskInformees.value = response.data.informees
      }

      $q.notify({ type: 'positive', message: 'مطلعین بروزرسانی شدند' })
    })
    .catch((err) => {
      console.error('Failed to change informees:', err)
      $q.notify({ type: 'negative', message: 'خطا در تغییر مطلعین' })
      taskInformees.value = old
    })
}

function handleMembersChange() {
  const payload = {
    task: editableTask.value.id,
    users: taskUsers.value,
  }

  api
    .post('pm/job-members-change/', payload)
    .then((response) => {
      editableTask.value.job.tasks = response.data

      emit('task-updated', {
        task_id: editableTask.value.id,
        job: editableTask.value.job,
        full_task_data: editableTask.value,
      })

      $q.notify({ type: 'positive', message: 'مسئولین بروزرسانی شدند' })
    })
    .catch((err) => {
      console.error('Failed to change members:', err)
      $q.notify({ type: 'negative', message: 'خطا در تغییر مسئولین' })
      taskUsers.value = props.task.job.tasks.filter((t) => t.is_committed).map((t) => t.user)
    })
}

const toPersianDigits = (val) => {
  if (typeof val !== 'string' && typeof val !== 'number') return val
  return String(val).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
}

const deadlinePickerValue = ref(null)

function onDeadlineChange() {
  if (!editableTask.value.is_owner) return

  const newVal = deadlinePickerValue.value || null

  editableTask.value.job.deadline = newVal
  updateJob({ deadline: newVal })
}

const hiddenDateInputRef = ref(null)

function openDatePicker() {
  // فقط اگر کاربر صاحب تسک باشد و اینپوت وجود داشته باشد
  if (editableTask.value.is_owner && hiddenDateInputRef.value) {
    hiddenDateInputRef.value.click()
  }
}

const chatTextareaRef = ref(null)

const autoResize = (el = chatTextareaRef.value) => {
  if (!el) return
  el.style.height = 'auto'
  const lh = parseFloat(getComputedStyle(el).lineHeight || '24')
  const max = lh * 5
  el.style.height = Math.min(el.scrollHeight, max) + 'px'
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
}

function onChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    addChat()
  }
}

// در فایل src\components\Task\AddTask.vue

watch(
  () => props.task,
  (newTask) => {
    if (newTask && newTask.id) {
      if (newTask.id !== editableTask.value.id) {
        editableTask.value = JSON.parse(JSON.stringify(newTask))
        taskUsers.value = newTask.job.tasks.filter((t) => t.is_committed).map((t) => t.user)
        taskInformees.value = newTask.job?.informees || newTask.job?.inform_users || []

        activeTab.value = route.query.tab || 'info'
        deadlinePickerValue.value = null
      } else {
        if (editableTask.value.job.status !== newTask.job.status) {
          editableTask.value.job.status = newTask.job.status
        }
        if (editableTask.value.tag !== newTask.tag) {
          editableTask.value.tag = newTask.tag
        }
      }
      loadActiveProjectList()
      fetchConfirmStatus(newTask.job.id)
      rebuildUnreadChatIds()
    }
  },
  {
    immediate: true,
    deep: true,
  },
)

onMounted(() => autoResize())
watch(
  () => newChat.value.body,
  () => autoResize(),
)

const fellowOptionsPanel = ref([])

watch(
  filteredFellowList,
  (v) => {
    fellowOptionsPanel.value = v || []
  },
  { immediate: true },
)

function filterFellowsPanel(val, update) {
  const sourceList = filteredFellowList.value || []

  if (!val) {
    update(() => {
      fellowOptionsPanel.value = sourceList
    })
    return
  }

  update(() => {
    const needle = String(val).toLowerCase()
    fellowOptionsPanel.value = sourceList.filter((u) => (u.name || '').toLowerCase().includes(needle))
  })
}

const projectsPanelFiltered = ref([])

watch(
  active_project_list_for_panel,
  (v) => {
    projectsPanelFiltered.value = Array.isArray(v) ? [...v] : []
  },
  { immediate: true, deep: true },
)

function filterProjectsPanel(option, q) {
  // option: {id,title}
  return String(option?.title || '')
    .toLowerCase()
    .includes(String(q || '').toLowerCase())
}
</script>

<template>
  <div class="bg-white relative flex flex-col rounded-lg h-full">
    <div class="flex w-full items-center rounded-t-lg bg-tintone px-2 py-2">
      <input
        class="text-primarymain bg-transparent border-b-[2px] pb-2 border-primarymain border-solid w-10/12 focus:outline-none"
        :disabled="!editableTask.is_owner || task.job.approval"
        v-model="editableTask.job.title"
        placeholder="نام وظیفه را وارد کنید"
        dense
        @blur="updateJob({ title: editableTask.job.title })"
        outlined
        @keydown.enter.exact.prevent="editableTask.is_owner && $event.target.blur()" />
      <q-tooltip :title="editableTask.job.title">{{ editableTask.job.title }}</q-tooltip>
      <div class="w-2/12 flex justify-end">
        <q-btn flat round dense icon="close" @click="emit('close')" class="text-primarymain" />
      </div>
    </div>

    <q-scroll-area class="flex-grow rounded-b-lg p-4 !pb-20">
      <!-- تب‌های با استایل جدید -->
      <!-- <div class="text-primarymain grid grid-cols-2 items-center gap-2">
        <div v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="['rounded-2xl cursor-pointer py-2 col-span-1 flex justify-center items-center', activeTab === tab.id ? 'bg-tintone' : '']">
          {{ tab.title }}
          <q-badge v-if="tab.id === 'message' && editableTask.job.chats?.length" color="primarymain" rounded :label="toPersianDigits(editableTask.job.chats.length)" class="!text-white -mt-4" />
        </div>
      </div> -->

      <q-tab-panels v-model="activeTab" animated class="bg-transparent pt-4">
        <q-tab-panel name="info" class="!p-0 grid grid-cols-12 gap-x-2 gap-y-2">
          <div class="col-span-full flex items-center justify-between">
            <p class="text-black font-semibold">تاریخ ثبت وظیفه:</p>
            <p class="text-primarymain" dir="ltr">{{ editableTask.job.create_time.slice(0, 10) }} &nbsp; {{ editableTask.job.create_time.slice(11, 16) }}</p>
          </div>
          <div v-if="editableTask.job.approval" class="p-2 mb-3 col-span-full rounded-lg border border-solid border-gray-300 bg-gray-50 text-gray-700">
            <div class="flex items-center">
              <span class="text-caption text-grey-7 ml-2">جلسه:</span>
              <span class="font-bold">{{ editableTask.job.approval_session_title }}</span>
            </div>
            <div class="flex items-center mt-1">
              <span class="text-caption text-grey-7 ml-2">تاریخ:</span>
              <span class="font-bold" dir="ltr">{{ editableTask.job.approval_session_date }}</span>
            </div>
          </div>
          <div class="col-span-full gap-2">
            <q-btn-toggle dir="ltr" v-model="editableTask.job.status" :options="statusOptions" color="tintone" text-color="primarymain" toggle-color="primarymain" unelevated rounded no-caps spread class="col-span-3" @update:model-value="updateJob({ status: $event })" />
          </div>
          <div class="col-span-6">
            <q-select
              :model-value="editableTask.tag"
              :options="boardOptions"
              :display-value="selectedBoardLabel"
              label="برچسب (بورد)"
              option-value="id"
              option-label="title"
              emit-value
              map-options
              rounded
              color="primarymain"
              outlined
              dense
              popup-content-class="text-right rtl text-black"
              dir="rtl"
              @update:model-value="changeTaskTag">
              <template v-slot:label>
                <div class="flex w-full items-start relative justify-start ml-[1000px] text-right" dir="rtl">
                  <div class="text-right bg-white px-2 z-40">برچسب (بورد)</div>
                </div>
              </template>
            </q-select>
          </div>

          <!-- مهلت -->
          <div class="col-span-6">
            <div class="flex flex-col">
              <div dir="rtl" class="border border-gray-400 border-solid rounded-3xl px-3 grid grid-cols-12 items-center" :style="{ opacity: !editableTask.is_owner ? 0.6 : 1 }" @click="openDatePicker">
                <div class="col-span-11 text-[13px] h-[38px] flex items-center gap-x-3" :class="{ 'cursor-pointer': editableTask.is_owner }">
                  <p class="text-grey-7">مهلت:</p>
                  <p class="font-semibold text-primarymain">
                    {{ toPersianDigits(editableTask.job.deadline) || 'انتخاب نشده' }}
                  </p>
                </div>
                <div v-if="editableTask.job.deadline && editableTask.is_owner" class="col-span-1 z-30 cursor-pointer flex justify-end" @click.stop="clearDeadline">
                  <q-icon name="close" class="text-lg text-primarymain" />
                </div>
              </div>
            </div>

            <div class="-mt-14 !flex">
              <div class="w-full">
                <vuedatePicker v-if="editableTask.is_owner" v-model="deadlinePickerValue" mode="single" type="date" format="jYYYY-jMM-jDD" auto-submit click-on="input" :column="1" class="bg-white opacity-0 w-full py-3" modal @submit="onDeadlineChange">
                  <template #icon></template>
                </vuedatePicker>
              </div>
            </div>
          </div>
          <div class="col-span-full">
            <SearchSelect v-model="editableTask.job.project" :options="projectsPanelFiltered" option-label="title" option-value="id" label="برنامه مصوب" :clearable="false" :disabled="!editableTask.is_owner" :filterFn="filterProjectsPanel" @select="(opt) => updateJob({ project: opt?.id })" />
          </div>
          <!-- <BaseSelect v-model="editableTask.job.urgency" :options="urgencyOptions" label="فوریت" option-label="label" option-value="value" emit-value map-options @update:model-value="updateJob({ urgency: $event })" :readonly="!editableTask.is_owner" /> -->
          <div class="col-span-full">
            <q-select
              label="مسئولان"
              v-model="taskUsers"
              :options="fellowOptionsPanel"
              multiple
              outlined
              dense
              emit-value
              map-options
              rounded
              color="primarymain"
              dir="rtl"
              option-value="id"
              option-label="name"
              @update:model-value="handleMembersChange"
              :readonly="isMembersListReadonly"
              class="q-mb-md"
              use-input
              input-debounce="200"
              @filter="filterFellowsPanel">
              <template v-slot:label>
                <div class="flex w-full items-start relative justify-start ml-[1000px] text-right" dir="rtl">
                  <div class="text-right bg-white px-2 z-40">مسئولان</div>
                </div>
              </template>
              <template v-slot:selected>
                <div dir="ltr" v-if="taskUsers.length > 0" class="flex items-center -space-x-2 q-pa-xs">
                  <q-avatar v-for="member in editableTask.job.tasks.filter((t) => taskUsers.includes(t.user))" :key="member.user" size="26px" class="border-2 border-white">
                    <img :src="mediaUrl + member.photo_url" />
                    <q-tooltip>{{ member.name }}</q-tooltip>
                  </q-avatar>
                </div>
                <div v-else class="text-grey-6">انتخاب مسئولان</div>
              </template>

              <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
                <q-item dir="rtl" v-bind="itemProps" :disable="taskUsers.length === 1 && taskUsers[0] === opt.id">
                  <q-item-section avatar>
                    <q-avatar size="md">
                      <img :src="mediaUrl + opt.photo_url" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ opt.name }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-checkbox :model-value="selected" @update:model-value="toggleOption(opt)" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
          <!-- مطلعین -->
          <div class="col-span-full -mt-3">
            <q-select
              label="مطلعین"
              v-model="taskInformees"
              :options="informeeOptionsPanel"
              multiple
              outlined
              dense
              emit-value
              map-options
              rounded
              color="primarymain"
              dir="rtl"
              option-value="id"
              option-label="name"
              @update:model-value="handleInformeesChange"
              :readonly="isInformeesReadonly"
              class="q-mb-md"
              use-input
              input-debounce="200"
              @filter="filterInformeesPanel">
              <template v-slot:label>
                <div class="flex w-full items-start relative justify-start ml-[1000px] text-right" dir="rtl">
                  <div class="text-right bg-white px-2 z-40">مطلعین</div>
                </div>
              </template>

              <template v-slot:selected>
                <div dir="ltr" v-if="taskInformees.length > 0" class="flex items-center -space-x-2 q-pa-xs">
                  <q-avatar v-for="member in fellow_list.filter((f) => taskInformees.includes(f.id))" :key="member.id" size="26px" class="border-2 border-white">
                    <img :src="mediaUrl + member.photo_url" />
                    <q-tooltip>{{ member.name }}</q-tooltip>
                  </q-avatar>
                </div>
              </template>

              <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
                <q-item dir="rtl" v-bind="itemProps">
                  <q-item-section avatar>
                    <q-avatar size="md">
                      <img :src="mediaUrl + opt.photo_url" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ opt.name }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-checkbox :model-value="selected" @update:model-value="toggleOption(opt)" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>

          <!-- پیام ها -->
          <div class="space-y-4 col-span-full" dir="rtl">
            <div class="message-input bg-white relative border border-primarymain rounded-[10px] px-2 pt-2">
              <textarea
                ref="chatTextareaRef"
                v-model="newChat.body"
                placeholder="پیام خود را بنویسید..."
                dir="rtl"
                class="w-full outline-none bg-white text-black resize-none"
                :style="{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: '1.6',
                  maxHeight: 'calc(4.6em * 5)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  textAlign: 'right',
                  paddingBottom: '10px',
                  paddingLeft: '80px',
                }"
                @input="autoResize($event.target)"
                @keydown="onChatKeydown" />
              <div class="append-buttons">
                <q-btn round dense flat color="primarymain" icon="attach_file" size="12px" @click="$refs.chatFileInput.pickFiles()" />
                <q-btn class="rotate-180" round dense flat icon="send" size="12px" color="primarymain" @click="addChat" />
              </div>
            </div>
            <q-file v-model="newChat.file" ref="chatFileInput" class="hidden" />
            <q-chip class="max-w-[20vh] truncate" v-if="newChat.file" :label="newChat.file.name" removable @remove="newChat.file = null" />

            <div class="flex flex-col gap-4 mt-10 overflow-y-auto">
              <div v-for="chat in editableTask.job.chats" :key="chat.id" class="rounded-3xl grid grid-cols-12 items-center px-2 py-2 rounded-bl-none" :class="isUnreadChat(chat.id) ? '!bg-red-100 border-2 border-red-400' : 'bg-tintone'">
                <!-- ساعت و تاریخ -->
                <div class="col-span-full flex justify-end mb-1">
                  <p class="text-xs">
                    <span>{{ chat.send_time.substring(11, 16) }}</span
                    >&thinsp;
                    <span class="mr-1">{{ chat.send_time.substring(0, 10) }}</span>
                  </p>
                </div>

                <!-- تصویر کاربر -->
                <div class="col-span-2">
                  <div class="avatar">
                    <div class="w-10 rounded-full">
                      <img :src="mediaUrl + chat.photo_url" />
                    </div>
                  </div>
                </div>

                <!-- نام کاربر -->
                <div class="col-span-10 flex items-center justify-between -mt-5">
                  <div class="flex items-center gap-2 min-w-0">
                    <p class="text-primarymain truncate w-[20vh]">{{ chat.name }}</p>
                  </div>

                  <q-btn v-if="chat.user === user.id" flat rounded dense color="primarymain" icon="delete" size="sm" @click="removeChat(chat.id)">
                    <q-tooltip class="bg-primarymain">حذف پیام</q-tooltip>
                  </q-btn>
                </div>

                <div class="col-span-2"></div>

                <!-- متن پیام و فایل -->
                <div class="col-span-9 -mt-4">
                  <p class="text-black text-xs" style="white-space: pre-line">{{ chat.body }}</p>
                  <div v-if="chat.file_url" class="flex items-center justify-between mt-2">
                    <p class="text-xs text-grey-7 max-w-[15vh] truncate">
                      {{ chat.file_url.substring(chat.file_url.lastIndexOf('/') + 1) }}
                    </p>
                    <div class="flex items-center gap-1">
                      <button @click="mediaDownload(chat.id, 'chat', chat.file_url.substring(chat.file_url.lastIndexOf('/') + 1))" class="text-primarymain">
                        <q-icon name="download" class="text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-span-full h-3 border-b-2 border-neutral-400 border-dashed"></div>
          <!-- توضیحات تکمیلی وظیفه -->
          <div class="col-span-full">
            <textarea
              v-model="editableTask.job.note"
              class="border-[1px] bg-white !pe-7 p-2 rounded-xl resize-none border-neutral-400 border-solid w-full placeholder-neutral-500 text-black focus:outline-none"
              rows="8"
              dir="rtl"
              :disabled="!editableTask.is_owner"
              @keydown.enter.exact.prevent="editableTask.is_owner && $event.target.blur()"
              @blur="updateJob({ note: editableTask.job.note })"
              placeholder="توضیحات تکمیلی وظیفه"
              autocomplete="off">
            </textarea>
          </div>
          <!-- افزودن پیوست -->
          <div class="bg-tintone col-span-full rounded-lg flex justify-between items-center px-2 py-2">
            <p class="text-base text-primarymain">پیوست‌ها</p>
            <q-btn v-if="editableTask.is_owner" round dense flat icon="add" color="primarymain" @click="newAppendix.dialog = true">
              <q-tooltip>افزودن پیوست</q-tooltip>
            </q-btn>
          </div>
          <div v-if="editableTask.job.appendices.length" class="!flex col-span-full !flex-col h-[200px] overflow-y-auto">
            <div v-for="appendix in editableTask.job.appendices" :key="appendix.id" class="!flex !flex-col pb-5 gap-2">
              <div class="flex justify-between border-b-[1px] pb-1 border-primarymain border-solid items-center">
                <div class="flex flex-col gap-1">
                  <p class="text-primarymain max-w-[20vh] truncate">
                    {{ appendix.title }}
                  </p>
                  <p class="max-w-[20vh] truncate">
                    {{ appendix.file_url.substring(appendix.file_url.lastIndexOf('/') + 1) }}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <button @click="mediaDownload(appendix.id, 'appendix', appendix.file_url.substring(appendix.file_url.lastIndexOf('/') + 1))">
                    <q-icon name="download" class="text-2xl mt-1 text-primarymain" />
                  </button>
                  <button @click="removeAppendix(appendix.id)">
                    <q-icon name="delete" class="text-2xl text-primarymain" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-grey-6 col-span-full py-4">پیوستی وجود ندارد.</div>
        </q-tab-panel>
      </q-tab-panels>
    </q-scroll-area>

    <div class="absolute bottom-0 w-full p-2 bg-white rounded-lg">
      <div class="flex flex-col gap-2">
        <!-- ردیف دکمه‌های ذخیره و بایگانی -->
        <div class="flex items-center justify-between">
          <button v-if="editableTask.is_owner" class="rounded-3xl border-primarymain hover:bg-tintone transition-all duration-150 border-[1px] border-solid w-5/12 py-1 text-primarymain cursor-pointer" @click="archiveTask">
            <p>{{ editableTask.job.archive ? 'بازیابی' : 'بایگانی' }}</p>
          </button>
          <button v-if="editableTask.is_owner" @click="removeTask" class="rounded-3xl border-red-500 hover:bg-red-50 transition-all duration-150 border-[1px] border-solid w-5/12 py-1 text-red-500 cursor-pointer">حذف</button>
        </div>

        <!-- ✅ دکمه جدید تأیید انجام کار -->
        <button
          v-if="editableTask.is_owner && editableTask.job.status === 'done'"
          class="w-full rounded-3xl transition-all duration-150 border-[1px] border-solid py-1 cursor-pointer"
          :class="editableTask.job.confirm ? 'border-red-600 hover:bg-[#ff4a4a13] text-red-600' : 'border-green-600 hover:bg-[#2cf45713] text-green-600'"
          @click="toggleConfirmation"
          :color="editableTask.job.confirm ? 'pink' : 'bor'">
          {{ editableTask.job.confirm ? 'عدم تأیید انجام کار' : 'تأیید انجام کار' }}
        </button>
      </div>
    </div>

    <q-dialog v-model="newAppendix.dialog">
      <q-card dir="rtl" class="!rounded-2xl text-primarymain" style="width: 400px">
        <q-card-section>
          <div class="text-h6">افزودن پیوست جدید</div>
        </q-card-section>
        <q-card-section class="q-pt-none space-y-4">
          <q-input rounded v-model="newAppendix.title" label="عنوان فایل" outlined dense autofocus>
            <template v-slot:label>
              <div class="flex w-full items-start relative mb-5 justify-start ml-[1000px] text-right" dir="rtl">
                <div class="text-right bg-white px-2 z-40">عنوان فایل</div>
              </div>
            </template>
          </q-input>
          <q-file v-model="newAppendix.file" rounded label="انتخاب فایل" outlined dense
            ><template v-slot:label>
              <div class="flex w-full items-start relative mb-5 justify-start ml-[1000px] text-right" dir="rtl">
                <div class="text-right bg-white px-2 z-40">انتخاب فایل</div>
              </div>
            </template></q-file
          >
        </q-card-section>
        <q-card-actions align="right" class="gap-4">
          <q-btn flat label="انصراف" color="primarymain" class="rounded-3xl" v-close-popup />
          <q-btn flat label="افزودن" color="primarymain" class="border-[1px] border-primarymain border-solid rounded-3xl" @click="addAppendix" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}

.message-input textarea {
  resize: none;
  min-height: 32px;
  max-height: 120px;
  line-height: 24px;
  padding: 4px 8px;
  overflow-y: auto;
  scrollbar-width: none;
}

.message-input :deep(textarea)::-webkit-scrollbar {
  display: none !important;
}

.message-input :deep(textarea) {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.message-input .append-buttons {
  position: absolute;
  bottom: 4px;
  left: 8px;
  display: flex;
  gap: 8px;
}
</style>
