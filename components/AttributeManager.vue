<template>
  <div>
    <div class="d-flex align-center">
      <v-text-field
        v-model="attributeName"
        label="نام ویژگی جدید یا ویرایش نام"
        variant="outlined"
        density="compact"
        hide-details
        @keydown.enter.prevent="handleSubmit"
      ></v-text-field>
      <v-btn
        icon
        :color="isEditMode ? 'success' : 'primary'"
        class="ml-2"
        @click="handleSubmit"
        :loading="loading"
      >
        <v-icon>{{ isEditMode ? 'mdi-check' : 'mdi-plus' }}</v-icon>
      </v-btn>
      <v-btn v-if="isEditMode" icon class="ml-2" @click="cancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <v-divider class="my-4"></v-divider>

    <v-list v-if="attributesStore.attributes.length > 0">
      <v-list-subheader>لیست ویژگی‌های موجود</v-list-subheader>
      <v-list-item
        v-for="attr in attributesStore.attributes"
        :key="attr.id"
        :title="attr.name"
      >
        <template v-slot:append>
          <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="handleDelete(attr)"></v-btn>
          <v-btn icon="mdi-pencil" variant="text" size="small" @click="startEditing(attr)"></v-btn>
        </template>
      </v-list-item>
    </v-list>
    <div v-else class="text-center text-gray-500 py-4">
      هنوز هیچ ویژگی‌ای تعریف نشده است.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAttributesStore, type Attribute } from '~/stores/attributes';
import { useToast } from '~/composables/useToast';

const attributesStore = useAttributesStore();
const { trigger: showToast } = useToast();

const loading = ref(false);
const attributeName = ref('');
const editingAttribute = ref<Attribute | null>(null);

const isEditMode = computed(() => !!editingAttribute.value);

onMounted(() => {
  if (attributesStore.attributes.length === 0) {
    attributesStore.fetchAttributes();
  }
});

const startEditing = (attr: Attribute) => {
  editingAttribute.value = attr;
  attributeName.value = attr.name;
};

const cancelEdit = () => {
  editingAttribute.value = null;
  attributeName.value = '';
};

const handleDelete = async (attr: Attribute) => {
  if (confirm(`آیا از حذف ویژگی "${attr.name}" مطمئن هستید؟`)) {
    loading.value = true;
    try {
      await attributesStore.deleteAttribute(attr.id);
      showToast('ویژگی با موفقیت حذف شد.', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      loading.value = false;
    }
  }
};

const handleSubmit = async () => {
  if (!attributeName.value.trim()) return;
  loading.value = true;
  try {
    if (isEditMode.value && editingAttribute.value) {
      await attributesStore.updateAttribute(editingAttribute.value.id, attributeName.value);
      showToast('ویژگی با موفقیت ویرایش شد.', 'success');
    } else {
      await attributesStore.addAttribute(attributeName.value);
      showToast('ویژگی با موفقیت اضافه شد.', 'success');
    }
    cancelEdit(); // Reset form
  } catch (error) {
    showToast('عملیات با خطا مواجه شد.', 'error');
  } finally {
    loading.value = false;
  }
};
</script>