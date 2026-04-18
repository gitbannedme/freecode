import React, { useEffect, useState } from "react";
import { SPINNER_VERBS } from "../lib/constants";

export function WorkingIndicator() {
  const [verb, setVerb] = useState(() => SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]);

  useEffect(() => {
    const t = setInterval(() => setVerb(SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="working-indicator">
      <div className="working-dots">
        <span className="working-dot" />
        <span className="working-dot" />
        <span className="working-dot" />
      </div>
      <span className="working-label">{verb}…</span>
    </div>
  );
}
