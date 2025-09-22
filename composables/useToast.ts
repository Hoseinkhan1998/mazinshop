// composables/useToast.ts
import { useState } from "#app";
import { readonly } from "vue";

export const useToast = () => {
  // state اصلی ما با استفاده از useState
  const state = useState("toast", () => ({
    show: false,
    message: "",
    type: "alert-info" as "alert-success" | "alert-error" | "alert-info",
  }));

  // تابع trigger برای تغییر state
  const trigger = (message: string, type: "success" | "error" | "info" = "success") => {
    state.value = {
      show: true,
      message: message,
      type: `alert-${type}`,
    };

    setTimeout(() => {
      state.value.show = false;
      setTimeout(() => {
        state.value = { show: false, message: "", type: "alert-info" };
      }, 500);
    }, 5000);
  };

  return {
    // یک نسخه فقط خواندنی از state را به بیرون پاس می‌دهیم
    toast: readonly(state),
    trigger,
  };
};
