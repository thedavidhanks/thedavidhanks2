// Small stroke icon set so the tool needs no icon-font dependency. Every icon
// shares one 24px grid, stroke width, and cap/join style; size follows the
// surrounding font size.
const Icon = ({ children, className = '' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={`afj-icon ${className}`}
    >
        {children}
    </svg>
);

export const PrinterIcon = () => (
    <Icon>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" />
    </Icon>
);

export const CopyIcon = () => (
    <Icon>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
);

export const CheckIcon = () => (
    <Icon>
        <path d="M20 6 9 17l-5-5" />
    </Icon>
);

export const ArrowLeftIcon = () => (
    <Icon>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
    </Icon>
);

export const TrashIcon = () => (
    <Icon>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
);

export const PlusIcon = () => (
    <Icon>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
    </Icon>
);
