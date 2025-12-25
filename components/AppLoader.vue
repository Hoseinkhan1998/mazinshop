<template>
  <div class="flex flex-col items-center justify-center space-y-4">
    <div class="relative">
      <div class="absolute inset-0 bg-stone-400/20 blur-3xl rounded-full animate-pulse"></div>
      
      <img 
        src="/images/logo.png" 
        class="h-20 w-auto relative z-10 animate-bounce-slow" 
        alt="Loading..."
      />
      
      <div class="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-6 mx-auto">
        <div class="h-full bg-stone-600 rounded-full loading-bar"></div>
      </div>
    </div>
    <p class="text-stone-500 text-xs font-medium animate-pulse">در حال آماده‌سازی MazinShop...</p>
  </div>
</template>

<style scoped>
@keyframes loading {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.loading-bar {
  width: 100%;
  animation: loading 1.5s infinite linear;
}
.animate-bounce-slow {
  animation: bounce 2s infinite ease-in-out;
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>