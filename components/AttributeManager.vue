<template>
  <div>
    <v-autocomplete
      v-model="selectedType"
      :items="typesStore.types"
      item-title="typename"
      item-value="id"
      label="ابتدا یک نوع محصول را انتخاب کنید"
      variant="outlined"
      density="compact"
      return-object
    ></v-autocomplete>

    <div v-if="selectedType" class="mt-4">
      <v-autocomplete
        v-model="selectedAttribute"
        :items="attributesStore.attributes"
        item-title="name"
        item-value="id"
        label="یک ویژگی را انتخاب یا یک نام جدید وارد کنید"
        variant="outlined"
        density="compact"
        return-object
        creatable
      ></v-autocomplete>
    </div>

    <div v-if="selectedType && selectedAttribute" class="mt-4">
      <v-text-field
        v-model="newAttributeValue"
        label="مقدار جدید برای ویژگی (مثلا: قرمز) و Enter بزنید"
        variant="outlined"
        density="compact"
        append-inner-icon="mdi-plus-box"
        @keydown.enter.prevent="addValueToChips"
        @click:append-inner="addValueToChips"
      ></v-text-field>

      <div v-if="chipValues.length > 0" class="mt-2">
        <v-chip
          v-for="(chip, index) in chipValues"
          :key="index"
          class="ml-2 mb-2"
          closable
          @click:close="removeChip(index)"
        >
          {{ chip }}
        </v-chip>
      </div>
    </div>
    
    <div class="mt-6 flex justify-end">
      <v-btn
        color="primary"
        :disabled="!selectedType || !selectedAttribute || chipValues.length === 0"
        :loading="loading"
        @click="handleSave"
      >
        ذخیره ویژگی‌ها برای این نوع
      </v-btn>
    </div>

    <v-divider class="my-6"></v-divider>
    <p class="text-center text-gray-500">بخش نمایش ویژگی‌های ذخیره شده</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTypesStore, type ProductType } from '~/stores/types';
import { useAttributesStore, type Attribute } from '~/stores/attributes';
import { useToast } from '~/composables/useToast';

const typesStore = useTypesStore();
const attributesStore = useAttributesStore();
const { trigger: showToast } = useToast();

const loading = ref(false);

const selectedType = ref<ProductType | null>(null);
const selectedAttribute = ref<Attribute | string | null>(null);
const newAttributeValue = ref('');
const chipValues = ref<string[]>([]);

onMounted(() => {
  typesStore.fetchTypes();
  attributesStore.fetchAttributes();
});

const addValueToChips = () => {
  const value = newAttributeValue.value.trim();
  if (!value) return;
  if (chipValues.value.includes(value)) {
    showToast('این مقدار قبلاً اضافه شده است.', 'error');
    return;
  }
  chipValues.value.push(value);
  newAttributeValue.value = '';
};

const removeChip = (index: number) => {
  chipValues.value.splice(index, 1);
};

const handleSave = async () => {
  if (!selectedType.value || !selectedAttribute.value || chipValues.value.length === 0) return;

  loading.value = true;
  try {
    let attributeId: number;

    // اگر ویژگی جدید بود، آن را در جدول attributes ذخیره کن
    if (typeof selectedAttribute.value === 'string') {
      const newAttr = await attributesStore.addAttribute(selectedAttribute.value);
      attributeId = newAttr.id;
    } else {
      attributeId = selectedAttribute.value.id;
    }

    // ویژگی را به نوع متصل کن (در جدول type_attributes)
    // این ممکن است خطا بدهد اگر از قبل وجود داشته باشد، که باید مدیریت شود
    try {
      await typesStore.linkAttributeToType(selectedType.value.id, attributeId);
    } catch (e: any) {
        // اگر خطا به خاطر unique constraint بود، یعنی این اتصال از قبل وجود دارد، که مشکلی نیست
        if(e.response?.data?.code !== '23505') throw e;
    }

    // مقادیر (چیپس‌ها) را در جدول attribute_values ذخیره کن
    for (const value of chipValues.value) {
        try {
            await attributesStore.addAttributeValue(attributeId, value);
        } catch (e: any) {
            if(e.response?.data?.code !== '23505') throw e;
        }
    }
    
    showToast('ویژگی‌ها با موفقیت برای این نوع ذخیره شدند.', 'success');
    // ریست کردن فرم
    selectedAttribute.value = null;
    chipValues.value = [];

  } catch (error) {
    showToast('خطا در ذخیره‌سازی ویژگی‌ها.', 'error');
    console.error(error);
  } finally {
    loading.value = false;
  }
};
</script>