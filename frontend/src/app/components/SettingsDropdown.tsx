import { useState, useRef, useEffect } from "react";
import { FiChevronDown } from "react-icons/fi";

interface SettingsDropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export function SettingsDropdown({
  value,
  options,
  onChange,
}: SettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="settings-dropdown-container" ref={containerRef}>
      <button
        className="settings-dropdown-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="settings-dropdown-value">{value}</span>
        <FiChevronDown
          size={16}
          className={`settings-dropdown-icon ${open ? "open" : ""}`}
        />
      </button>

      {open && (
        <ul className="settings-dropdown-menu">
          {options.map((option) => (
            <li key={option}>
              <button
                className={`settings-dropdown-item ${
                  value === option ? "active" : ""
                }`}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
