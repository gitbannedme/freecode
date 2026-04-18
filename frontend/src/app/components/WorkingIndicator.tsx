import React, { useEffect, useState } from "react";
import { SPINNER_FRAMES, SPINNER_VERBS } from "../lib/constants";

export function WorkingIndicator() {
  const [f, setF] = useState(0);
  const [verb, setVerb] = useState(() => SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]);
  
  useEffect(() => {
    const t = setInterval(() => setF(i => (i + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setVerb(SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]), 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="working-indicator">
      <span>{SPINNER_FRAMES[f]}</span>
      <span>{verb}…</span>
    </div>
  );
}
