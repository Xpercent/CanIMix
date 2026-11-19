export function StatusBar() {
  return (
    <div className="po-status" aria-hidden="true">
      <div className="po-status-zoom">
        <svg className="po-status-time" fill="none" viewBox="0 0 35 12">
          <path
            clipRule="evenodd"
            d="M4.2 0.5C6.65 0.5 8 2.4 8 6C8 9.6 6.65 11.5 4.2 11.5C1.75 11.5 0.4 9.6 0.4 6C0.4 2.4 1.75 0.5 4.2 0.5ZM4.2 2.1C2.95 2.1 2.25 3.45 2.25 6C2.25 8.55 2.95 9.9 4.2 9.9C5.45 9.9 6.15 8.55 6.15 6C6.15 3.45 5.45 2.1 4.2 2.1Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <path
            clipRule="evenodd"
            d="M13 0.5C15.4 0.5 16.8 2.3 16.8 5.5C16.8 9.2 15.3 11.5 12.85 11.5C10.9 11.5 9.75 10.45 9.55 8.95H11.35C11.55 9.65 12.1 10 12.85 10C14.1 10 14.95 8.9 14.95 6.75C14.35 7.45 13.5 7.75 12.6 7.75C10.6 7.75 9.3 6.25 9.3 4.15C9.3 1.95 10.8 0.5 13 0.5ZM13 2C11.85 2 11.1 2.85 11.1 4.08C11.1 5.3 11.85 6.15 13 6.15C14.15 6.15 14.95 5.3 14.95 4.08C14.95 2.85 14.15 2 13 2Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <circle cx="19" cy="3.6" fill="currentColor" r="1.05" />
          <circle cx="19" cy="8.4" fill="currentColor" r="1.05" />
          <path
            clipRule="evenodd"
            d="M25.45 0.7H27.65V7.6H29.1V9.25H27.65V11.3H25.8V9.25H21V7.6L25.45 0.7ZM25.8 3.38L23.08 7.6H25.8V3.38Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <path
            d="M32.3 0.7H34.2V11.3H32.3V2.55L29.8 4.15V2.45L32.3 0.7Z"
            fill="currentColor"
          />
        </svg>
        <span className="po-status-icons">
          <svg fill="none" viewBox="0 0 18 12">
            <rect fill="currentColor" height="4.5" rx="1" width="3" x="0" y="7.5" />
            <rect fill="currentColor" height="6.5" rx="1" width="3" x="5" y="5.5" />
            <rect fill="currentColor" height="9" rx="1" width="3" x="10" y="3" />
            <rect fill="currentColor" height="12" rx="1" width="3" x="15" y="0" />
          </svg>
          <svg fill="none" viewBox="0 0 17 12">
            <path
              d="M0.58 3.58A11.2 11.2 0 0 1 16.42 3.58L14.86 5.14A9 9 0 0 0 2.14 5.14Z"
              fill="currentColor"
            />
            <path
              d="M3.48 6.48A7.1 7.1 0 0 1 13.52 6.48L11.96 8.04A4.9 4.9 0 0 0 5.04 8.04Z"
              fill="currentColor"
            />
            <path
              d="M6.38 9.38A3 3 0 0 1 10.62 9.38L8.75 11.25Q8.5 11.5 8.25 11.25Z"
              fill="currentColor"
            />
          </svg>
          <svg className="po-status-battery" fill="none" viewBox="0 0 25 12">
            <rect
              height="11"
              rx="2.8"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1"
              width="21"
              x="0.5"
              y="0.5"
            />
            <rect fill="currentColor" height="8" rx="1.5" width="18" x="2" y="2" />
            <path d="M23 4A1.4 2 0 0 1 23 8Z" fill="currentColor" fillOpacity="0.4" />
          </svg>
        </span>
      </div>
    </div>
  )
}
