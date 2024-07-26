import { useQueryClient, QueryKey } from "@tanstack/react-query";

export function useInvalidateScopedQueries() {
    const qc = useQueryClient();
  
    return (queryKey: QueryKey) =>
      qc.invalidateQueries({
        predicate: (query) => {
          if (typeof queryKey === 'string') {
            return query.queryKey.includes(queryKey);
          } else if (Array.isArray(queryKey)) {
            const [_scope, ...rest] = query.queryKey;
            
            return rest.every((key, index) => queryKey[index] === key);
          }
          return false;
        },
      });
  }
  