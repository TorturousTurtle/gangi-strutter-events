"use client";

import { useEffect, useState } from "react";
import Toast from "./Toast";

export default function AdminToastClient() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("updated") === "1") {
      setShow(true);

      // Remove the param from the URL (so toast only shows once)
      params.delete("updated");
      const newUrl = `${window.location.pathname}?${params.toString()}`.replace(
        /\?$/,
        ""
      );
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  if (!show) return null;
  return <Toast message="Event updated successfully!" />;
}
