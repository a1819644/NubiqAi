import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    // Gunakan event.matches dari objek event yang disediakan
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches); // Menggunakan nilai dari event
    };

    mql.addEventListener("change", onChange);
    
    // Untuk pengecekan awal, gunakan mql.matches agar konsisten
    setIsMobile(mql.matches);

    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
