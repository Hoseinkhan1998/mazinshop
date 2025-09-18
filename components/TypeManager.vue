<template>
  <div>
    <p class=" text-xl font-semibold mb-3">مدیریت تایپ‌ها</p>
    <div class="d-flex gap-3 align-center">
      <v-text-field
        rounded="lg"
        v-model="typeName"
        label="نام نوع جدید یا ویرایش نام"
        variant="outlined"
        density="compact"
        hide-details
        @keydown.enter.prevent="handleSubmit"></v-text-field>
      <v-btn icon :color="isEditMode ? 'success' : 'primarymain'" class="ml-2" @click="handleSubmit" :loading="loading">
        <v-icon>{{ isEditMode ? "mdi-check" : "mdi-plus" }}</v-icon>
      </v-btn>
      <v-btn color="red" v-if="isEditMode" icon class="ml-2" @click="cancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <v-divider class="my-4"></v-divider>

    <v-list>
      <v-list-subheader>لیست انواع موجود</v-list-subheader>
      <div class=" !flex flex-col max-h-[60vh] overflow-y-auto ">
        <v-list-item v-for="type in typesStore.types" :key="type.id" :title="type.typename">
          <template v-slot:append>
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="handleDelete(type)"></v-btn>
            <v-btn icon="mdi-pencil" class="text-primarymain" variant="text" size="small" @click="startEditing(type)"></v-btn>
          </template>
        </v-list-item>
      </div>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useTypesStore, type ProductType } from "~/stores/types";

const typesStore = useTypesStore();
const loading = ref(false);
const typeName = ref("");
const editingType = ref<ProductType | null>(null);

const isEditMode = computed(() => !!editingType.value);

onMounted(() => {
  if (typesStore.types.length === 0) {
    typesStore.fetchTypes();
  }
});

const startEditing = (type: ProductType) => {
  editingType.value = type;
  typeName.value = type.typename;
};

const cancelEdit = () => {
  editingType.value = null;
  typeName.value = "";
};

const handleSubmit = async () => {
  if (!typeName.value.trim()) return;
  loading.value = true;
  try {
    if (isEditMode.value && editingType.value) {
      await typesStore.updateType(editingType.value.id, typeName.value);
    } else {
      await typesStore.addType(typeName.value);
    }
    cancelEdit(); // Reset form
  } catch (error) {
    alert("عملیات با خطا مواجه شد.");
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (type: ProductType) => {
  if (confirm(`آیا از حذف نوع "${type.typename}" مطمئن هستید؟`)) {
    loading.value = true;
    try {
      await typesStore.deleteType(type.id);
    } catch (error: any) {
      alert(error.message); // نمایش پیام خطا به کاربر
    } finally {
      loading.value = false;
    }
  }
};
</script>
