import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

export function usePathname() {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();

  return {
    back() {
      window.history.back();
    },
    forward() {
      window.history.forward();
    },
    prefetch() {},
    push(to) {
      navigate(to);
    },
    replace(to) {
      navigate(to, { replace: true });
    }
  };
}

export { useParams };

export function useSearchParamsCompat() {
  const [searchParams] = useSearchParams();
  return searchParams;
}

export { useSearchParamsCompat as useSearchParams };

export function notFound() {
  throw new Error("RouteNotFound");
}
