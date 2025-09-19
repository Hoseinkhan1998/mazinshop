<script setup lang="ts">
// import { ref, onMounted, computed } from "vue";
import { useTypesStore, type ProductType } from "~/stores/types";
import { useToast } from "~/composables/useToast";
import { useProductStore } from "~/stores/products";
const { trigger: showToast } = useToast();

const typesStore = useTypesStore();
const productStore = useProductStore();
const loading = ref(false);
const typeName = ref("");
const editingType = ref<ProductType | null>(null);

const isEditMode = computed(() => !!editingType.value);

const editDialog = ref(false);
const editLoading = ref(false);
const typeToEdit = ref<ProductType | null>(null);
const isTypeUsed = ref(false);

onMounted(() => {
  if (typesStore.types.length === 0) {
    typesStore.fetchTypes();
  }
  if (productStore.products.length === 0) {
    productStore.fetchProducts();
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

const checkTypeUsage = async (typeId: number): Promise<boolean> => {
  await productStore.fetchProducts();
  return productStore.products.some((product) => product.type_id === typeId);
};

const handleSubmit = async () => {
  if (!typeName.value.trim()) return;

  if (isEditMode.value && editingType.value) {
    isTypeUsed.value = await checkTypeUsage(editingType.value.id);
    if (isTypeUsed.value) {
      typeToEdit.value = editingType.value;
      editDialog.value = true;
    } else {
      await performEdit();
    }
  } else {
    // حالت افزودن بدون تغییر
    loading.value = true;
    try {
      await typesStore.addType(typeName.value);
      cancelEdit();
    } catch (error) {
      showToast("عملیات با خطا مواجه شد.", "error");
    } finally {
      loading.value = false;
    }
  }
};

const performEdit = async () => {
  if (!editingType.value) return;
  loading.value = true;
  try {
    await typesStore.updateType(editingType.value.id, typeName.value);
    showToast("تایپ با موفقیت ویرایش شد", "success");
    cancelEdit();
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
  } finally {
    loading.value = false;
  }
};

const confirmEdit = async () => {
  editLoading.value = true;
  try {
    await performEdit();
    editDialog.value = false;
    typeToEdit.value = null;
    isTypeUsed.value = false;
  } catch (error: any) {
    showToast(error.message, "error");
  } finally {
    editLoading.value = false;
  }
};

const deleteDialog = ref(false);
const deleteLoading = ref(false);
const typeToDelete = ref<ProductType | null>(null);

// تابع جدید برای باز کردن دیالوگ
const openDeleteDialog = (type: ProductType) => {
  typeToDelete.value = type;
  deleteDialog.value = true;
};

// تابع جدید برای تأیید حذف
const confirmDelete = async () => {
  if (!typeToDelete.value) return;

  deleteLoading.value = true;
  try {
    await typesStore.deleteType(typeToDelete.value.id);
    showToast("تایپ با موفقیت حذف شد", "success");
    deleteDialog.value = false;
    typeToDelete.value = null;
  } catch (error: any) {
    showToast(error.message, "error");
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="!p-3">
    <div class="!p-3 !rounded-xl border-2 border-primarymain border-dashed">
      <p class="text-xl font-semibold mb-3">مدیریت تایپ‌ها</p>
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
        <div class="!flex flex-col max-h-[60vh] overflow-y-auto">
          <v-list-item v-for="type in typesStore.types" :key="type.id" :title="type.typename">
            <template v-slot:append>
              <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="openDeleteDialog(type)"></v-btn>
              <v-btn icon="mdi-pencil" class="text-primarymain" variant="text" size="small" @click="startEditing(type)"></v-btn>
            </template>
          </v-list-item>
        </div>
      </v-list>
    </div>
  </div>
  <v-dialog v-model="deleteDialog" max-width="400">
    <v-card class="!rounded-xl">
      <v-card-title class="d-flex align-center">
        <v-icon color="error" class="ml-2">mdi-alert-circle</v-icon>
        <span>تأیید حذف</span>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="pt-4">
        <p>
          آیا از حذف تایپ <strong>"{{ typeToDelete?.typename }}"</strong> مطمئن هستید؟
        </p>
        <p class="text-caption text-error mt-2">این عمل غیرقابل بازگشت است!</p>
      </v-card-text>

      <v-card-actions class="justify-end">
        <v-btn color="grey" variant="text" @click="deleteDialog = false" :disabled="deleteLoading"> انصراف </v-btn>
        <v-btn color="error" variant="flat" @click="confirmDelete" :loading="deleteLoading"> حذف </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="editDialog" max-width="450">
    <v-card class="!rounded-xl">
      <v-card-title class="d-flex align-center">
        <v-icon color="warning" class="ml-2">mdi-alert</v-icon>
        <span>هشدار ویرایش</span>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="pt-4">
        <p>
          این تایپ <strong>"{{ typeToEdit?.typename }}"</strong> در برخی محصولات استفاده شده است.
        </p>
        <p>آیا مطمئن هستید که می‌خواهید آن را ویرایش کنید؟</p>
        <p class="text-caption text-warning mt-2">این تغییر ممکن است بر محصولات تأثیر بگذارد!</p>
      </v-card-text>

      <v-card-actions class="justify-end">
        <v-btn
          color="grey"
          variant="text"
          @click="
            editDialog = false;
            cancelEdit();
          "
          :disabled="editLoading">
          انصراف
        </v-btn>
        <v-btn color="warning" variant="flat" @click="confirmEdit" :loading="editLoading"> ویرایش </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
