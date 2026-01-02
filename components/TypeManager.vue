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
const selectedAttributes = ref<(Attribute | string)[]>([]);
const isEditMode = computed(() => !!editingType.value);
const DEFAULT_TYPE_IMAGE = "/images/type-default.jpg";
const fileInputRef = ref<HTMLInputElement | null>(null);
const pickedImageFile = ref<File | null>(null);
const pickedImagePreviewUrl = ref<string | null>(null);
const currentDbImageUrl = ref<string | null>(null);
const imageClearedByUser = ref(false);

// State برای دیالوگ‌های تایید
const editDialog = ref(false);
const editLoading = ref(false);
const deleteDialog = ref(false);
const deleteLoading = ref(false);
const typeToDelete = ref<ProductType | null>(null);
const showOnHome = ref(false);
const heroTitle = ref("");
const heroSubtitle = ref("");
const heroImageFile = ref<File | null>(null);
const heroImagePreview = ref<string | null>(null);
const heroImageClearedByUser = ref(false);
const heroFileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  if (typesStore.types.length === 0) typesStore.fetchTypes();
  if (attributesStore.attributes.length === 0) attributesStore.fetchAttributes();
  if (productStore.products.length === 0) productStore.fetchProducts();
});

watch(editingType, (newType) => {
  if (pickedImagePreviewUrl.value) {
    URL.revokeObjectURL(pickedImagePreviewUrl.value);
  }

  pickedImageFile.value = null;
  pickedImagePreviewUrl.value = null;
  imageClearedByUser.value = false;

  if (newType) {
    typeName.value = newType.typename;
    selectedAttributes.value = newType.attributes ? [...newType.attributes] : [];
    currentDbImageUrl.value = (newType as any).image_url ?? null;
    showOnHome.value = !!(newType as any).show_on_home;
    heroTitle.value = ((newType as any).hero_title || "") as string;
    heroSubtitle.value = ((newType as any).hero_subtitle || "") as string;

    heroImageFile.value = null;
    heroImageClearedByUser.value = false;
    heroImagePreview.value = ((newType as any).hero_image_url || null) as string | null;
  } else {
    typeName.value = "";
    selectedAttributes.value = [];
    currentDbImageUrl.value = null;
    showOnHome.value = false;
    heroTitle.value = "";
    heroSubtitle.value = "";
    heroImageFile.value = null;
    heroImagePreview.value = null;
    heroImageClearedByUser.value = false;
  }
});

const effectiveTypeImageUrl = computed(() => {
  return pickedImagePreviewUrl.value || currentDbImageUrl.value || DEFAULT_TYPE_IMAGE;
});

const hasAnyRealImage = computed(() => {
  return !!pickedImagePreviewUrl.value || !!currentDbImageUrl.value;
});

const startEditing = (type: ProductType) => {
  editingType.value = type;
};

const cancelEdit = () => {
  editingType.value = null;
  typeName.value = "";
  selectedAttributes.value = [];
  currentDbImageUrl.value = null;
  imageClearedByUser.value = false;

  if (pickedImagePreviewUrl.value) {
    URL.revokeObjectURL(pickedImagePreviewUrl.value);
  }
  pickedImagePreviewUrl.value = null;
  pickedImageFile.value = null;

  if (fileInputRef.value) fileInputRef.value.value = "";
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

const validateSquareImage = (file: File) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 1.5 * 1024 * 1024; // 1.5MB

  if (!allowed.includes(file.type)) return Promise.resolve("فرمت تصویر باید JPG/PNG/WEBP باشد.");
  if (file.size > maxSize) return Promise.resolve("حجم تصویر نباید بیشتر از ۱.۵ مگابایت باشد.");

  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      if (w < 600 || h < 600) return resolve("ابعاد تصویر باید حداقل ۶۰۰×۶۰۰ باشد.");
      const ratio = w / h;
      if (ratio < 0.9 || ratio > 1.1) return resolve("تصویر باید تقریباً مربع باشد (نسبت نزدیک ۱:۱).");

      resolve(null);
    };
    img.onerror = () => resolve("فایل تصویر معتبر نیست.");
    img.src = URL.createObjectURL(file);
  });
};

const uploadTypeImage = async (file: File) => {
  const { $supabase } = useNuxtApp();

  const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "");
  const fileName = `types/${Date.now()}-${cleanName}`;

  const { error } = await $supabase.storage.from("type-images").upload(fileName, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = $supabase.storage.from("type-images").getPublicUrl(fileName);
  return data.publicUrl;
};

const validateHeroImage = (file: File) =>
  new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      URL.revokeObjectURL(url);

      const ratio = w / h;

      const minW = 1600;
      const minH = 500;
      const minRatio = 2.6;
      const maxRatio = 3.6;

      if (w < minW || h < minH) {
        return reject(new Error(`ابعاد تصویر کوچک است. حداقل ${minW}×${minH} لازم است.`));
      }
      if (ratio < minRatio || ratio > maxRatio) {
        return reject(new Error("نسبت تصویر برای Hero مناسب نیست. تصویر باید حدوداً عریض (نزدیک 3:1) باشد."));
      }
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("فایل تصویر معتبر نیست."));
    };
    img.src = url;
  });

const uploadHeroImage = async (file: File) => {
  const { $supabase } = useNuxtApp();

  const safeName = file.name.replace(/[^a-zA-Z0-9.-_]/g, "");
  const fileName = `hero/${Date.now()}-${safeName}`;

  const { error } = await $supabase.storage.from("type-images").upload(fileName, file);
  if (error) throw error;

  const { data } = $supabase.storage.from("type-images").getPublicUrl(fileName);
  return data.publicUrl as string;
};

const deleteTypeImageByUrl = async (publicUrl: string) => {
  if (!publicUrl) return;
  const marker = "/storage/v1/object/public/type-images/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const path = decodeURIComponent(publicUrl.substring(idx + marker.length));
  if (!path) return;

  const { $supabase } = useNuxtApp();
  const { error } = await $supabase.storage.from("type-images").remove([path]);
  if (error) {
    console.error("Error deleting old type image:", error);
  }
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const onFilePicked = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!file) return;

  const err = await validateSquareImage(file);
  if (err) {
    showToast(err, "error");
    input.value = ""; // ریست انتخاب
    return;
  }

  if (pickedImagePreviewUrl.value) {
    URL.revokeObjectURL(pickedImagePreviewUrl.value);
  }

  pickedImageFile.value = file;
  pickedImagePreviewUrl.value = URL.createObjectURL(file);

  imageClearedByUser.value = false;
};

const clearSelectedImage = () => {
  if (pickedImagePreviewUrl.value) {
    URL.revokeObjectURL(pickedImagePreviewUrl.value);
  }

  pickedImageFile.value = null;
  pickedImagePreviewUrl.value = null;

  if (isEditMode.value && currentDbImageUrl.value) {
    currentDbImageUrl.value = null;
    imageClearedByUser.value = true;
  } else {
    currentDbImageUrl.value = null;
    imageClearedByUser.value = true;
  }

  if (fileInputRef.value) fileInputRef.value.value = "";
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

    let uploadedTypeImageUrl: string | null = null;
    if (pickedImageFile.value) {
      uploadedTypeImageUrl = await uploadTypeImage(pickedImageFile.value);
    }

    let uploadedHeroImageUrl: string | null = null;
    if (heroImageFile.value) {
      uploadedHeroImageUrl = await uploadHeroImage(heroImageFile.value);
    }

    if (isEditMode.value && editingType.value) {
      const typeId = editingType.value.id;

      const oldTypeUrl = (editingType.value as any).image_url as string | null;
      const oldHeroUrl = (editingType.value as any).hero_image_url as string | null;

      await typesStore.updateTypeWithAttributes(typeId, trimmedTypeName, attributeIds);

      if (uploadedTypeImageUrl) {
        await typesStore.updateTypeImage(typeId, uploadedTypeImageUrl);

        if (oldTypeUrl && oldTypeUrl !== uploadedTypeImageUrl) {
          await deleteTypeImageByUrl(oldTypeUrl);
        }
      } else if (imageClearedByUser.value) {
        await typesStore.updateTypeImage(typeId, null);

        if (oldTypeUrl) {
          await deleteTypeImageByUrl(oldTypeUrl);
        }
      }

      if (!showOnHome.value) {
        await typesStore.updateTypeHeroFields(typeId, {
          show_on_home: false,
          hero_title: null,
          hero_subtitle: null,
          hero_image_url: null,
        });

        if (oldHeroUrl) {
          await deleteTypeImageByUrl(oldHeroUrl);
        }
      } else {
        let finalHeroUrl: string | null = oldHeroUrl;

        if (uploadedHeroImageUrl) {
          finalHeroUrl = uploadedHeroImageUrl;
        } else if (heroImageClearedByUser.value) {
          finalHeroUrl = null;
        }

        await typesStore.updateTypeHeroFields(typeId, {
          show_on_home: true,
          hero_title: heroTitle.value.trim() || null,
          hero_subtitle: heroSubtitle.value.trim() || null,
          hero_image_url: finalHeroUrl,
        });

        // پاکسازی فایل قبلی اگر تغییر کرده یا حذف شده
        if (oldHeroUrl && oldHeroUrl !== finalHeroUrl) {
          await deleteTypeImageByUrl(oldHeroUrl);
        }
      }

      showToast("نوع با موفقیت ویرایش شد.", "success");
    } else {
      const newType = await typesStore.addTypeWithAttributes(trimmedTypeName, attributeIds, uploadedTypeImageUrl);

      if (showOnHome.value) {
        await typesStore.updateTypeHeroFields(newType.id, {
          show_on_home: true,
          hero_title: heroTitle.value.trim() || null,
          hero_subtitle: heroSubtitle.value.trim() || null,
          hero_image_url: uploadedHeroImageUrl, // ممکن است null باشد
        });
      }

      showToast("نوع جدید با موفقیت اضافه شد.", "success");
    }

    cancelEdit();
    clearSelectedImage();

    // ریست Hero UI
    heroImageFile.value = null;
    heroImagePreview.value = null;
    heroImageClearedByUser.value = false;
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

const pickHeroImage = () => heroFileInput.value?.click();

const onHeroFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    await validateHeroImage(file);
    heroImageFile.value = file;
    heroImageClearedByUser.value = false;
    heroImagePreview.value = URL.createObjectURL(file);
  } catch (err: any) {
    showToast(err.message || "تصویر Hero معتبر نیست.", "error");
    heroImageFile.value = null;
    heroImagePreview.value = null;
    heroImageClearedByUser.value = false;
  } finally {
    input.value = "";
  }
};

const removeHeroImage = () => {
  heroImageFile.value = null;
  heroImagePreview.value = null;
  heroImageClearedByUser.value = true;
};
</script>

<template>
  <div class="!p-3">
    <div class="!p-3 !rounded-xl border-2 border-primarymain border-dashed">
      <p class="text-xl font-semibold mb-3">مدیریت تایپ‌ها و ویژگی‌ها</p>
      <div class="p-4 border rounded-lg">
        <h4 class="font-semibold mb-4">{{ isEditMode ? `ویرایش نوع: ${editingType?.typename}` : "افزودن نوع جدید" }}</h4>
        <v-text-field rounded="lg" v-model="typeName" label="نام نوع" variant="outlined" density="compact" class="mb-4" hide-details></v-text-field>
        <!-- ✅ انتخاب/پیش‌نمایش تصویر دسته -->
        <div class="mb-4">
          <div class="flex items-center gap-4">
            <div class="relative w-24 h-24 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
              <img :src="effectiveTypeImageUrl" class="w-full h-full object-cover" draggable="false" />

              <!-- ضربدر حذف -->
              <button
                v-if="hasAnyRealImage"
                type="button"
                @click="clearSelectedImage"
                class="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
                aria-label="حذف تصویر">
                ✕
              </button>
            </div>

            <div class="flex flex-col gap-2">
              <v-btn color="primary" variant="flat" class="rounded-lg" @click="openFilePicker"> انتخاب / تغییر تصویر </v-btn>

              <p class="text-xs text-neutral-500 leading-5">فقط JPG/PNG/WEBP — مربع نزدیک ۱:۱ — حداقل ۶۰۰×۶۰۰ — حداکثر ۱.۵MB</p>
              <p class=" text-xs">
                <span>برای ساخت تصویر با ابعاد مناسب از </span>
                <span class="text-blue-600 text-sm cursor-pointer"><a href="https://imageresizer.com/" target="_blank"> این سایت</a></span> استفاده کنید
              </p>
            </div>
          </div>

          <!-- input واقعی فایل (مخفی) -->
          <input ref="fileInputRef" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onFilePicked" />
        </div>

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

        <v-checkbox v-model="showOnHome" label="انتخاب برای نمایش در صفحه اول (Hero)" density="compact" class="mt-2"></v-checkbox>

        <div v-if="showOnHome" class="mt-3 border rounded-lg p-3">
          <p class="font-semibold mb-3">تنظیمات Hero برای این دسته‌بندی</p>

          <v-text-field rounded="lg" v-model="heroTitle" label="عنوان اصلی Hero" variant="outlined" density="compact" class="mb-3" hide-details />

          <v-textarea rounded="lg" v-model="heroSubtitle" label="زیرعنوان Hero" variant="outlined" density="compact" rows="3" class="mb-3" hide-details />

          <!-- Hero Image Picker -->
          <input ref="heroFileInput" type="file" accept="image/*" class="hidden" @change="onHeroFileChange" />

          <div class="mb-2 text-sm text-gray-500">پیشنهاد: 1920×650 — حداقل 1600×500 — نسبت حدوداً 3:1</div>

          <div v-if="heroImagePreview" class="relative w-full overflow-hidden rounded-xl border">
            <img :src="heroImagePreview" class="w-full h-[180px] object-cover" />
            <button
              type="button"
              class="absolute top-2 left-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
              @click="removeHeroImage"
              aria-label="حذف تصویر">
              ✕
            </button>
          </div>

          <button
            v-else
            type="button"
            class="w-full h-[180px] rounded-xl border-2 border-dashed flex items-center justify-center hover:bg-neutral-50 transition"
            @click="pickHeroImage">
            انتخاب تصویر Hero
          </button>
        </div>

        <div class="flex justify-end mt-4 gap-2">
          <v-btn v-if="isEditMode" @click="cancelEdit">انصراف</v-btn>
          <v-btn color="primary" @click="handleSubmit" :loading="loading"> ذخیره </v-btn>
        </div>
      </div>

      <v-divider class="my-4"></v-divider>

      <v-list>
        <v-list-subheader>لیست انواع تعریف شده</v-list-subheader>
        <div class="!flex flex-col">
          <v-list-item v-for="type in typesStore.types" :key="type.id" class="border-b">
            <template v-slot:prepend>
              <v-avatar size="44" rounded="lg">
                <img :src="(type as any).image_url || DEFAULT_TYPE_IMAGE" class="w-full h-full object-cover" />
              </v-avatar>
            </template>

            <v-list-item-title class="flex items-center gap-2 font-semibold">
              <span>{{ type.typename }}</span>

              <!-- Badge Hero -->
              <v-chip v-if="(type as any).show_on_home" size="x-small" color="primary" variant="flat" class="!h-5"> بخش اصلی صفحه اول</v-chip>
            </v-list-item-title>

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
