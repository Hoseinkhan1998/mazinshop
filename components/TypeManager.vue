<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useTypesStore, type ProductType } from "~/stores/types";
import { useAttributesStore, type Attribute } from "~/stores/attributes";
import { useProductStore } from "~/stores/products";
import { useToast } from "~/composables/useToast";

const typesStore = useTypesStore();
const attributesStore = useAttributesStore();
const productStore = useProductStore();
const { trigger: showToast } = useToast();

const loading = ref(false);
const typeName = ref("");
const editingType = ref<ProductType | null>(null);
const selectedAttributes = ref<(Attribute | string)[]>([]); // می‌تواند شامل نام‌های جدید به صورت رشته باشد

const isEditMode = computed(() => !!editingType.value);

// State برای دیالوگ‌های تایید
const editDialog = ref(false);
const editLoading = ref(false);
const deleteDialog = ref(false);
const deleteLoading = ref(false);
const typeToDelete = ref<ProductType | null>(null);

onMounted(() => {
  if (typesStore.types.length === 0) typesStore.fetchTypes();
  if (attributesStore.attributes.length === 0) attributesStore.fetchAttributes();
  if (productStore.products.length === 0) productStore.fetchProducts();
});

watch(editingType, (newType) => {
  if (newType) {
    typeName.value = newType.typename;
    selectedAttributes.value = newType.attributes ? [...newType.attributes] : [];
  } else {
    typeName.value = "";
    selectedAttributes.value = [];
  }
});

const startEditing = (type: ProductType) => {
  editingType.value = type;
};

const cancelEdit = () => {
  editingType.value = null;
  typeName.value = "";
  selectedAttributes.value = [];
};

const checkTypeUsage = (typeId: number): boolean => {
  return productStore.products.some((product) => product.type_id === typeId);
};

const ensureAttributesExist = async (attributes: (Attribute | string)[]) => {
  const attributeIds: number[] = [];
  for (const attr of attributes) {
    if (typeof attr === "string") {
      const existingAttr = attributesStore.attributes.find((a) => a.name.toLowerCase() === attr.toLowerCase().trim());

      if (existingAttr) {
        attributeIds.push(existingAttr.id);
      } else {
        const newAttr = await attributesStore.addAttribute(attr.trim());
        attributeIds.push(newAttr.id);
      }
    } else {
      attributeIds.push(attr.id);
    }
  }
  return [...new Set(attributeIds)];
};

const performSaveOrUpdate = async () => {
  loading.value = true;
  try {
    const attributeIds = await ensureAttributesExist(selectedAttributes.value);
    if (isEditMode.value && editingType.value) {
      await typesStore.updateTypeWithAttributes(editingType.value.id, typeName.value, attributeIds);
      showToast("نوع با موفقیت ویرایش شد.", "success");
    } else {
      await typesStore.addTypeWithAttributes(typeName.value, attributeIds);
      showToast("نوع جدید با موفقیت اضافه شد.", "success");
    }
    cancelEdit();
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  const trimmedTypeName = typeName.value.trim();
  if (!trimmedTypeName) {
    showToast("نام نوع نمی‌تواند خالی باشد.", "error");
    return;
  }

  const existingType = typesStore.types.find((t) => t.typename.toLowerCase() === trimmedTypeName.toLowerCase());
  if (!isEditMode.value && existingType) {
    showToast("نوعی با این نام از قبل وجود دارد.", "error");
    return;
  }
  if (isEditMode.value && existingType && existingType.id !== editingType.value?.id) {
    showToast("نوع دیگری با این نام از قبل وجود دارد.", "error");
    return;
  }

  loading.value = true;
  try {
    const attributeIds = await ensureAttributesExist(selectedAttributes.value);

    if (isEditMode.value && editingType.value) {
      await typesStore.updateTypeWithAttributes(editingType.value.id, trimmedTypeName, attributeIds);
      showToast("نوع با موفقیت ویرایش شد.", "success");
    } else {
      await typesStore.addTypeWithAttributes(trimmedTypeName, attributeIds);
      showToast("نوع جدید با موفقیت اضافه شد.", "success");
    }
    cancelEdit();
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
    console.error("Error in handleSubmit:", error);
  } finally {
    loading.value = false;
  }
};

const confirmEdit = async () => {
  editLoading.value = true;
  await performSaveOrUpdate();
  editLoading.value = false;
  editDialog.value = false;
};

const openDeleteDialog = (type: ProductType) => {
  const isUsed = checkTypeUsage(type.id);

  if (isUsed) {
    showToast("این نوع توسط حداقل یک محصول استفاده شده و قابل حذف نیست.", "error");
  } else {
    typeToDelete.value = type;
    deleteDialog.value = true;
  }
};

const confirmDelete = async () => {
  if (!typeToDelete.value) return;
  deleteLoading.value = true;
  try {
    await typesStore.deleteType(typeToDelete.value.id);
    showToast("تایپ با موفقیت حذف شد", "success");
    await attributesStore.fetchAttributes(true);
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
      <p class="text-xl font-semibold mb-3">مدیریت تایپ‌ها و ویژگی‌ها</p>
      <div class="p-4 border rounded-lg">
        <h4 class="font-semibold mb-4">{{ isEditMode ? `ویرایش نوع: ${editingType?.typename}` : "افزودن نوع جدید" }}</h4>
        <v-text-field rounded="lg" v-model="typeName" label="نام نوع" variant="outlined" density="compact" class="mb-4" hide-details></v-text-field>

        <v-combobox
          rounded="lg"
          v-model="selectedAttributes"
          :items="attributesStore.attributes"
          item-title="name"
          label="ویژگی‌های مربوط به این نوع را انتخاب یا تایپ کنید"
          variant="outlined"
          density="compact"
          multiple
          chips
          closable-chips
          return-object></v-combobox>

        <div class="flex justify-end mt-4 gap-2">
          <v-btn v-if="isEditMode" @click="cancelEdit">انصراف</v-btn>
          <v-btn color="primary" @click="handleSubmit" :loading="loading"> ذخیره </v-btn>
        </div>
      </div>

      <v-divider class="my-4"></v-divider>

      <v-list>
        <v-list-subheader>لیست انواع تعریف شده</v-list-subheader>
        <div class="!flex flex-col max-h-[40vh] overflow-y-auto">
          <v-list-item v-for="type in typesStore.types" :key="type.id" class="border-b">
            <v-list-item-title class="font-semibold">{{ type.typename }}</v-list-item-title>
            <v-list-item-subtitle>
              <div v-if="type && type.attributes && type.attributes.length > 0" class="mt-2">
                <v-chip v-for="attr in type.attributes" :key="attr.id" size="small" class="ml-1 mb-1">{{ attr.name }}</v-chip>
              </div>
              <span v-else class="text-xs italic">هیچ ویژگی‌ای متصل نشده است.</span>
            </v-list-item-subtitle>
            <template v-slot:append>
              <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="openDeleteDialog(type)"></v-btn>
              <v-btn icon="mdi-pencil" class="text-primarymain" variant="text" size="small" @click="startEditing(type)"></v-btn>
            </template>
          </v-list-item>
        </div>
      </v-list>
    </div>

    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card class="!rounded-xl" v-if="typeToDelete">
        <v-card-title class="d-flex align-center">
          <v-icon color="error" class="ml-2">mdi-alert-circle</v-icon>
          <span>تأیید حذف</span>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pt-4">
          <p>
            آیا از حذف تایپ <strong>"{{ typeToDelete.typename }}"</strong> مطمئن هستید؟
          </p>
          <p class="text-caption text-error mt-2">این عمل غیرقابل بازگشت است!</p>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn color="grey" variant="text" @click="deleteDialog = false" :disabled="deleteLoading">انصراف</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete" :loading="deleteLoading">حذف</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editDialog" max-width="450">
      <v-card class="!rounded-xl" v-if="editingType">
        <v-card-title class="d-flex align-center">
          <v-icon color="warning" class="ml-2">mdi-alert</v-icon>
          <span>هشدار ویرایش</span>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pt-4">
          <p>
            این تایپ <strong>"{{ editingType.typename }}"</strong> در برخی محصولات استفاده شده است.
          </p>
          <p>آیا مطمئن هستید که می‌خواهید آن را ویرایش کنید؟</p>
          <p class="text-caption text-warning mt-2">این تغییر ممکن است بر محصولات تأثیر بگذارد!</p>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn color="grey" variant="text" @click="editDialog = false" :disabled="editLoading">انصراف</v-btn>
          <v-btn color="warning" variant="flat" @click="confirmEdit" :loading="editLoading">با این حال ویرایش کن</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
