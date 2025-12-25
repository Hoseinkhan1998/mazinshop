// composables/useGlobalLoading.ts
export const useGlobalLoading = () => {
  const isGlobalLoading = useState('global_app_loading', () => false);

  const setGlobalLoading = (val: boolean) => {
    isGlobalLoading.value = val;
  };

  return { isGlobalLoading, setGlobalLoading };
};