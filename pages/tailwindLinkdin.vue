<template>
  <div class="h-screen flex flex-col text-left gap-5 bg-neutral-100 w-6/12 !p-20 text-black font-semibold" dir="ltr">
    <div class="flex items-center gap-3">
      <!-- Without object-position -->
      <div class="w-32 h-20 overflow-hidden rounded-lg !border">
        <img src="/images/tailwind.png" class="w-full h-full object-cover" />
      </div>
      <!-- With object-position -->
      <div class="w-32 h-20 overflow-hidden rounded-lg !border">
        <img src="/images/tailwind.png" class="w-full h-10 object-cover object-top" />
      </div>
      <!-- Custom positioning -->
      <div class="w-32 h-20 overflow-hidden rounded-lg border">
        <img src="/images/tailwind.png" class="w-28 h-10 object-cover object-[25%_75%]" />
      </div>
    </div>
  </div>
</template>

<script>
export default {};
</script>

<style></style>
