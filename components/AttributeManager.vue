<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useTypesStore, type ProductType } from "~/stores/types";
import { useAttributesStore, type Attribute } from "~/stores/attributes";
import { useToast } from "~/composables/useToast";
import axios from "axios";

const typesStore = useTypesStore();
const attributesStore = useAttributesStore();
const { trigger: showToast } = useToast();

const loading = ref(false);

const selectedType = ref<ProductType | null>(null);
const selectedAttribute = ref<Attribute | null>(null);
const newAttributeValue = ref("");
const chipValues = ref<string[]>([]); // مقادیر (values) برای ویژگی انتخاب شده

onMounted(() => {
  if (typesStore.types.length === 0) typesStore.fetchTypes();
});

// با انتخاب یک زوج نوع-ویژگی، مقادیر فعلی را واکشی می‌کنیم
watch([selectedType, selectedAttribute], async ([newType, newAttr]) => {
  chipValues.value = [];
  // وقتی کاربر ویژگی را عوض کرد، فیلد متن را هم خالی می‌کنیم
  newAttributeValue.value = "";

  if (newType && newAttr) {
    loading.value = true;
    try {
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/type_attribute_options?type_id=eq.${newType.id}&attribute_id=eq.${newAttr.id}&select=value`;
      const response = await axios.get(url, { headers: { apikey: config.public.supabaseKey } });
      chipValues.value = response.data.map((item: { value: string }) => item.value);
    } catch (error) {
      console.error("Error fetching options:", error);
      showToast("خطا در واکشی مقادیر.", "error");
    } finally {
      loading.value = false;
    }
  }
});

const addValueToChips = () => {
  const value = newAttributeValue.value.trim();
  if (!value) return;
  if (chipValues.value.find((v) => v.toLowerCase() === value.toLowerCase())) {
    showToast("این مقدار قبلاً اضافه شده است.", "error");
    return;
  }
  chipValues.value.push(value);
  newAttributeValue.value = "";
};

const removeChip = (index: number) => {
  chipValues.value.splice(index, 1);
};

const handleSave = async () => {
  if (!selectedType.value || !selectedAttribute.value) {
    showToast("لطفاً نوع و ویژگی را انتخاب کنید.", "error");
    return;
  }
  loading.value = true;
  try {
    // از اکشن syncAttributeOptions که از قبل داشتیم، استفاده می‌کنیم
    await attributesStore.syncAttributeOptions(selectedType.value.id, selectedAttribute.value.id, chipValues.value);
    showToast("مقادیر با موفقیت ذخیره شدند.", "success");
  } catch (error) {
    showToast("خطا در ذخیره‌سازی.", "error");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="!p-3">
    <div class="!p-3 !rounded-xl border-2 border-primarymain border-dashed">
      <p class="text-xl font-semibold mb-3">مدیریت مقادیرِ ویژگی‌ها بر اساس نوع</p>

      <v-autocomplete
        v-model="selectedType"
        :items="typesStore.types"
        item-title="typename"
        label="۱. ابتدا نوع محصول را انتخاب کنید"
        variant="outlined"
        density="compact"
        return-object
        class="mb-4"></v-autocomplete>

      <v-autocomplete
        v-model="selectedAttribute"
        :items="selectedType?.attributes || []"
        item-title="name"
        label="۲. سپس ویژگی مورد نظر را انتخاب کنید"
        variant="outlined"
        density="compact"
        return-object
        class="mb-4"
        :disabled="!selectedType"></v-autocomplete>

      <div v-if="selectedType && selectedAttribute">
        <v-text-field
          v-model="newAttributeValue"
          label="۳. مقدار جدید (مثلا: قرمز) را وارد و Enter بزنید"
          variant="outlined"
          density="compact"
          append-inner-icon="mdi-plus-box"
          @keydown.enter.prevent="addValueToChips"
          @click:append-inner="addValueToChips"></v-text-field>

        <div v-if="chipValues.length > 0" class="mt-2 p-2 border rounded-lg min-h-[50px]">
          <v-chip v-for="(chip, index) in chipValues" :key="index" class="ml-2 mb-2" closable @click:close="removeChip(index)">
            {{ chip }}
          </v-chip>
        </div>

        <div class="flex justify-end mt-6">
          <v-btn color="primary" :loading="loading" @click="handleSave"> ذخیره مقادیر برای این ویژگی </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>
